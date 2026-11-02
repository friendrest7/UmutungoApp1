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

	"github.com/umutungo/umutungo/backend/internal/config"
	"github.com/umutungo/umutungo/backend/internal/db"
)

func TestOwnerWorkspaceDataIsIsolatedAndPaymentSubmissionIsIdempotent(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run owner workspace integration tests")
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
	phoneA, phoneB := "+2507"+suffix[:8], "+2508"+suffix[:8]
	var ownerA, ownerB string
	if err = pool.QueryRow(ctx, `INSERT INTO users(name,phone,role,workspace_kind) VALUES('Workspace Owner A',$1,'property_owner','landlord') RETURNING id`, phoneA).Scan(&ownerA); err != nil {
		t.Fatal(err)
	}
	if err = pool.QueryRow(ctx, `INSERT INTO users(name,phone,role,workspace_kind) VALUES('Workspace Owner B',$1,'property_owner','property_owner') RETURNING id`, phoneB).Scan(&ownerB); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM users WHERE id IN ($1,$2)`, ownerA, ownerB) })
	tokenA, tokenB := "workspace-owner-a-"+suffix, "workspace-owner-b-"+suffix
	for _, session := range []struct{ user, token string }{{ownerA, tokenA}, {ownerB, tokenB}} {
		if _, err = pool.Exec(ctx, `INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')`, session.user, hash(session.token)); err != nil {
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
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		return res
	}
	createdProperty := request(http.MethodPost, "/api/v1/owner/workspace", tokenA, map[string]any{"name": "Kacyiru house", "province": "City of Kigali", "district": "Gasabo", "sector": "Kacyiru", "unit": "Ground floor", "monthly_rent": 180000})
	if createdProperty.Code != http.StatusCreated {
		t.Fatalf("create property status %d: %s", createdProperty.Code, createdProperty.Body.String())
	}
	var property struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(createdProperty.Body.Bytes(), &property); err != nil || property.ID == "" {
		t.Fatalf("property response %s, err %v", createdProperty.Body.String(), err)
	}
	otherWorkspace := request(http.MethodGet, "/api/v1/owner/workspace", tokenB, nil)
	if otherWorkspace.Code != http.StatusOK || bytes.Contains(otherWorkspace.Body.Bytes(), []byte(property.ID)) {
		t.Fatalf("owner B saw owner A property: %d %s", otherWorkspace.Code, otherWorkspace.Body.String())
	}
	var unitID string
	if err := pool.QueryRow(ctx, `SELECT id FROM managed_units WHERE property_id=$1`, property.ID).Scan(&unitID); err != nil {
		t.Fatal(err)
	}
	foreignCharge := request(http.MethodPost, "/api/v1/owner/workspace?action=charge", tokenB, map[string]any{"unit_id": unitID, "tenant_name": "Tenant", "tenant_phone": "+250788123456", "amount_due": 180000, "due_date": "2026-11-01"})
	if foreignCharge.Code != http.StatusBadRequest {
		t.Fatalf("cross-owner charge status = %d, body %s", foreignCharge.Code, foreignCharge.Body.String())
	}
	charge := request(http.MethodPost, "/api/v1/owner/workspace?action=charge", tokenA, map[string]any{"unit_id": unitID, "tenant_name": "Tenant A", "tenant_phone": "+250788123456", "amount_due": 180000, "due_date": "2026-11-01"})
	if charge.Code != http.StatusCreated {
		t.Fatalf("create charge status %d: %s", charge.Code, charge.Body.String())
	}
	var chargeData struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(charge.Body.Bytes(), &chargeData)
	paymentInput := map[string]any{"charge_id": chargeData.ID, "amount": 70000, "method": "mtn_momo", "reference": "recorded manually", "idempotency_key": "receipt-" + suffix}
	first := request(http.MethodPost, "/api/v1/owner/workspace?action=payment", tokenA, paymentInput)
	if first.Code != http.StatusCreated {
		t.Fatalf("record payment status %d: %s", first.Code, first.Body.String())
	}
	duplicate := request(http.MethodPost, "/api/v1/owner/workspace?action=payment", tokenA, paymentInput)
	if duplicate.Code != http.StatusOK || !bytes.Contains(duplicate.Body.Bytes(), []byte(`"duplicate":true`)) {
		t.Fatalf("duplicate payment response %d: %s", duplicate.Code, duplicate.Body.String())
	}
	foreignPayment := request(http.MethodPost, "/api/v1/owner/workspace?action=payment", tokenB, map[string]any{"charge_id": chargeData.ID, "amount": 1, "method": "cash", "idempotency_key": "foreign-" + suffix})
	if foreignPayment.Code != http.StatusNotFound {
		t.Fatalf("cross-owner payment status = %d, body %s", foreignPayment.Code, foreignPayment.Body.String())
	}
	overshoot := request(http.MethodPost, "/api/v1/owner/workspace?action=payment", tokenA, map[string]any{"charge_id": chargeData.ID, "amount": 110001, "method": "cash", "idempotency_key": "overshoot-" + suffix})
	if overshoot.Code != http.StatusConflict {
		t.Fatalf("overpayment status = %d, body %s", overshoot.Code, overshoot.Body.String())
	}
}
