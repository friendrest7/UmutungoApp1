package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/umutungo/umutungo/backend/internal/config"
	"github.com/umutungo/umutungo/backend/internal/db"
)

func TestLandlordTrialAndLockIntegration(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run landlord access integration tests")
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
	newUser := func(label, kind, phonePrefix string) (string, string) {
		var id string
		if err := pool.QueryRow(ctx, `INSERT INTO users(name,phone,role,workspace_kind) VALUES($1,$2,'property_owner',$3) RETURNING id`, label, phonePrefix+suffix[:8], kind).Scan(&id); err != nil {
			t.Fatal(err)
		}
		token := label + "-" + suffix
		if _, err := pool.Exec(ctx, `INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')`, id, hash(token)); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			_, _ = pool.Exec(ctx, `DELETE FROM notifications WHERE user_id=$1`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM landlord_trials WHERE user_id=$1`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM subscriptions WHERE user_id=$1`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, id)
		})
		return id, token
	}
	landlord, landlordToken := newUser("trial-landlord", "landlord", "+2507")
	owner, ownerToken := newUser("trial-owner", "property_owner", "+2508")
	_ = owner
	paid, paidToken := newUser("paid-landlord", "landlord", "+2509")

	handler := New(pool, config.Config{}).Handler()
	get := func(path, token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		return res
	}
	access := func(token string) landlordAccess {
		res := get("/api/v1/owner/access", token)
		if res.Code != http.StatusOK {
			t.Fatalf("access: %d %s", res.Code, res.Body.String())
		}
		var out struct {
			Access landlordAccess `json:"access"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		return out.Access
	}
	countTrials := func(userID string) int {
		var n int
		if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM subscriptions WHERE user_id=$1 AND is_trial`, userID).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}

	// First visit grants exactly one Silver trial, even under concurrent requests.
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); get("/api/v1/owner/workspace", landlordToken) }()
	}
	wg.Wait()
	a := access(landlordToken)
	if !a.Required || a.State != "trial" || a.Tier != "silver" || !a.IsTrial || !a.TrialUsed || a.DaysLeft != a.TrialDays {
		t.Fatalf("trial access wrong: %+v", a)
	}
	if n := countTrials(landlord); n != 1 {
		t.Fatalf("expected one trial subscription, got %d", n)
	}
	if res := get("/api/v1/owner/workspace", landlordToken); res.Code != http.StatusOK {
		t.Fatalf("workspace during trial: %d %s", res.Code, res.Body.String())
	}

	// Once the trial ends the workspace locks and no second trial is granted.
	if _, err := pool.Exec(ctx, `UPDATE subscriptions SET starts_at=NOW()-INTERVAL '31 days', ends_at=NOW()-INTERVAL '1 minute' WHERE user_id=$1 AND is_trial`, landlord); err != nil {
		t.Fatal(err)
	}
	if a := access(landlordToken); a.State != "locked" || !a.TrialUsed {
		t.Fatalf("expected locked after trial: %+v", a)
	}
	for _, path := range []string{"/api/v1/owner/workspace", "/api/v1/owner/portal"} {
		res := get(path, landlordToken)
		if res.Code != http.StatusPaymentRequired {
			t.Fatalf("%s after trial: %d %s", path, res.Code, res.Body.String())
		}
		var body struct {
			Code string `json:"code"`
		}
		_ = json.Unmarshal(res.Body.Bytes(), &body)
		if body.Code != "plan_required" {
			t.Fatalf("%s: wrong code %q", path, body.Code)
		}
	}
	if n := countTrials(landlord); n != 1 {
		t.Fatalf("trial was granted again: %d", n)
	}

	// A paid plan reopens the workspace.
	if _, err := pool.Exec(ctx, `INSERT INTO subscriptions(user_id,tier,status,business_role,amount,starts_at,ends_at) VALUES($1,'gold','active','landlord',20000,NOW(),NOW()+INTERVAL '30 days')`, landlord); err != nil {
		t.Fatal(err)
	}
	if a := access(landlordToken); a.State != "active" || a.Tier != "gold" || a.IsTrial {
		t.Fatalf("expected active gold: %+v", a)
	}
	if res := get("/api/v1/owner/portal", landlordToken); res.Code != http.StatusOK {
		t.Fatalf("portal with paid plan: %d", res.Code)
	}

	// Property owners (not landlords) are never gated or given a landlord trial.
	if a := access(ownerToken); a.Required || a.State != "active" {
		t.Fatalf("property owner should not be gated: %+v", a)
	}
	if res := get("/api/v1/owner/workspace", ownerToken); res.Code != http.StatusOK {
		t.Fatalf("property owner workspace: %d", res.Code)
	}

	// A landlord who already paid before gets no trial.
	if _, err := pool.Exec(ctx, `INSERT INTO subscriptions(user_id,tier,status,business_role,amount,starts_at,ends_at) VALUES($1,'silver','expired','landlord',10000,NOW()-INTERVAL '40 days',NOW()-INTERVAL '10 days')`, paid); err != nil {
		t.Fatal(err)
	}
	if a := access(paidToken); a.State != "locked" || a.TrialUsed {
		t.Fatalf("returning paid landlord should be locked without a trial: %+v", a)
	}
	if n := countTrials(paid); n != 0 {
		t.Fatalf("returning paid landlord got a trial")
	}
}
