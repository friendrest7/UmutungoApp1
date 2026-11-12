package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/umutungo/umutungo/backend/internal/config"
	"github.com/umutungo/umutungo/backend/internal/db"
)

func TestSummarizeTenantsStatusPriority(t *testing.T) {
	today := time.Date(2026, 11, 12, 0, 0, 0, 0, time.UTC)
	day := func(offset int) time.Time { return today.AddDate(0, 0, offset) }
	charges := []ownerChargeRow{
		{ID: "1", TenantName: "Aline", TenantPhone: "+250781", UnitID: "u1", AmountDue: 100, Paid: 0, DueDate: day(-7)},
		{ID: "2", TenantName: "Aline", TenantPhone: "+250781", UnitID: "u1", AmountDue: 100, Paid: 40, DueDate: day(-2)},
		{ID: "3", TenantName: "Aline", TenantPhone: "+250781", UnitID: "u1", AmountDue: 100, Paid: 0, DueDate: day(20)},
		{ID: "4", TenantName: "Ben", TenantPhone: "+250782", UnitID: "u2", AmountDue: 200, Paid: 0, DueDate: day(0)},
		{ID: "5", TenantName: "Cara", TenantPhone: "+250783", UnitID: "u3", AmountDue: 300, Paid: 300, DueDate: day(-30)},
		{ID: "6", TenantName: "Dan", TenantPhone: "+250784", UnitID: "u4", AmountDue: 400, Paid: 0, DueDate: day(5)},
	}
	got := map[string]map[string]any{}
	for _, row := range summarizeTenants(charges, today) {
		got[row["name"].(string)] = row
	}
	if got["Aline"]["status"] != "overdue" || got["Aline"]["days_overdue"] != 7 || got["Aline"]["overdue_balance"] != int64(160) || got["Aline"]["balance"] != int64(260) {
		t.Fatalf("Aline summary wrong: %#v", got["Aline"])
	}
	if got["Ben"]["status"] != "due_today" || got["Cara"]["status"] != "paid" || got["Dan"]["status"] != "upcoming" {
		t.Fatalf("statuses wrong: Ben=%v Cara=%v Dan=%v", got["Ben"]["status"], got["Cara"]["status"], got["Dan"]["status"])
	}
	if formatRWF(8240000) != "RWF 8,240,000" || formatRWF(500) != "RWF 500" {
		t.Fatalf("formatRWF wrong: %s %s", formatRWF(8240000), formatRWF(500))
	}
}

func TestOwnerPortalIntegration(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run owner portal integration tests")
	}
	ctx := context.Background()
	pool, err := db.NewPool(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := db.Migrate(ctx, pool, filepath.Join("..", "..", "migrations")); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}
	suffix, err := randomToken()
	if err != nil {
		t.Fatal(err)
	}
	var ownerA, ownerB string
	if err = pool.QueryRow(ctx, `INSERT INTO users(name,phone,role,workspace_kind) VALUES('Portal Owner A',$1,'property_owner','landlord') RETURNING id`, "+2507"+suffix[:8]).Scan(&ownerA); err != nil {
		t.Fatal(err)
	}
	if err = pool.QueryRow(ctx, `INSERT INTO users(name,phone,role,workspace_kind) VALUES('Portal Owner B',$1,'property_owner','landlord') RETURNING id`, "+2508"+suffix[:8]).Scan(&ownerB); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM users WHERE id IN ($1,$2)`, ownerA, ownerB) })
	tokenA, tokenB := "portal-owner-a-"+suffix, "portal-owner-b-"+suffix
	for _, session := range []struct{ user, token string }{{ownerA, tokenA}, {ownerB, tokenB}} {
		if _, err = pool.Exec(ctx, `INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')`, session.user, hash(session.token)); err != nil {
			t.Fatal(err)
		}
	}
	var propertyID, unitID string
	if err = pool.QueryRow(ctx, `INSERT INTO managed_properties(owner_id,name,province,district,sector) VALUES($1,'Portal Residences','City of Kigali','Gasabo','Kimihurura') RETURNING id`, ownerA).Scan(&propertyID); err != nil {
		t.Fatal(err)
	}
	if err = pool.QueryRow(ctx, `INSERT INTO managed_units(property_id,owner_id,name,monthly_rent) VALUES($1,$2,'Apt 1',180000) RETURNING id`, propertyID, ownerA).Scan(&unitID); err != nil {
		t.Fatal(err)
	}
	today := kigaliToday()
	for _, offset := range []int{-4, 0, 2} {
		if _, err = pool.Exec(ctx, `INSERT INTO owner_rent_charges(owner_id,unit_id,tenant_name,tenant_phone,amount_due,due_date) VALUES($1,$2,'Aline Uwase','+250788000001',180000,$3)`, ownerA, unitID, today.AddDate(0, 0, offset)); err != nil {
			t.Fatal(err)
		}
	}

	handler := New(pool, config.Config{}).Handler()
	request := func(method, path, token string, body any) *httptest.ResponseRecorder {
		var content []byte
		if body != nil {
			content, _ = json.Marshal(body)
		}
		req := httptest.NewRequest(method, path, bytes.NewReader(content))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		return res
	}
	type portal struct {
		Tenants []struct {
			Name           string `json:"name"`
			Status         string `json:"status"`
			DaysOverdue    int    `json:"days_overdue"`
			OverdueBalance int64  `json:"overdue_balance"`
		} `json:"tenants"`
		OpenCharges   []map[string]any `json:"open_charges"`
		Announcements []map[string]any `json:"announcements"`
	}
	read := func(token string) portal {
		res := request(http.MethodGet, "/api/v1/owner/portal", token, nil)
		if res.Code != http.StatusOK {
			t.Fatalf("portal GET: %d %s", res.Code, res.Body.String())
		}
		var out portal
		if err := json.Unmarshal(res.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		return out
	}

	a := read(tokenA)
	if len(a.Tenants) != 1 || a.Tenants[0].Status != "overdue" || a.Tenants[0].DaysOverdue != 4 || a.Tenants[0].OverdueBalance != 180000 || len(a.OpenCharges) != 3 {
		t.Fatalf("owner A tenants wrong: %+v open=%d", a.Tenants, len(a.OpenCharges))
	}
	if b := read(tokenB); len(b.Tenants) != 0 || len(b.OpenCharges) != 0 {
		t.Fatalf("owner B must not see owner A tenants: %+v", b)
	}

	// Announcements: scoped to the owner's own properties.
	if res := request(http.MethodPost, "/api/v1/owner/portal?action=announcement", tokenB, map[string]string{"property_id": propertyID, "title": "Water", "message": "Off"}); res.Code != http.StatusBadRequest {
		t.Fatalf("owner B announcing to owner A property: %d %s", res.Code, res.Body.String())
	}
	res := request(http.MethodPost, "/api/v1/owner/portal?action=announcement", tokenA, map[string]string{"property_id": propertyID, "title": "Water maintenance", "message": "Water will be off on Saturday morning."})
	if res.Code != http.StatusCreated {
		t.Fatalf("announcement: %d %s", res.Code, res.Body.String())
	}
	var created struct {
		RecipientCount int `json:"recipient_count"`
	}
	_ = json.Unmarshal(res.Body.Bytes(), &created)
	if created.RecipientCount != 1 || len(read(tokenA).Announcements) != 1 || len(read(tokenB).Announcements) != 0 {
		t.Fatalf("announcement recipients/scoping wrong: %d", created.RecipientCount)
	}

	// Reminders: validation, then one of each kind, then no repeats.
	if res := request(http.MethodPut, "/api/v1/owner/portal?action=reminders", tokenA, map[string]any{"days_before": 99, "overdue_interval": 3, "upcoming_message": "a", "due_today_message": "b", "overdue_message": "c"}); res.Code != http.StatusBadRequest {
		t.Fatalf("invalid reminder settings accepted: %d", res.Code)
	}
	if res := request(http.MethodPut, "/api/v1/owner/portal?action=reminders", tokenA, map[string]any{"auto_enabled": false, "days_before": 3, "overdue_interval": 3, "send_on_due": true, "upcoming_message": "Hi {tenant}, {amount} due {due_date}", "due_today_message": "Today {tenant}", "overdue_message": "Late {tenant} {amount}"}); res.Code != http.StatusOK {
		t.Fatalf("save reminder settings: %d %s", res.Code, res.Body.String())
	}
	send := func(token string) []map[string]any {
		res := request(http.MethodPost, "/api/v1/owner/portal?action=send-reminders", token, map[string]any{})
		if res.Code != http.StatusOK {
			t.Fatalf("send reminders: %d %s", res.Code, res.Body.String())
		}
		var out struct {
			Items []map[string]any `json:"items"`
		}
		_ = json.Unmarshal(res.Body.Bytes(), &out)
		return out.Items
	}
	first := send(tokenA)
	kinds := map[string]string{}
	for _, item := range first {
		kinds[item["kind"].(string)] = item["message"].(string)
	}
	if len(first) != 3 || kinds["overdue"] != "Late Aline Uwase RWF 180,000" || kinds["due_today"] != "Today Aline Uwase" || kinds["upcoming"] == "" {
		t.Fatalf("first reminder run wrong: %+v", first)
	}
	if again := send(tokenA); len(again) != 0 {
		t.Fatalf("reminders repeated too soon: %+v", again)
	}
	if other := send(tokenB); len(other) != 0 {
		t.Fatalf("owner B got owner A reminders: %+v", other)
	}
}
