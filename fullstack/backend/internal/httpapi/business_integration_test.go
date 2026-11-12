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

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/umutungo/umutungo/backend/internal/config"
	"github.com/umutungo/umutungo/backend/internal/db"
)

type integrationEnv struct {
	t       *testing.T
	ctx     context.Context
	pool    *pgxpool.Pool
	server  *Server
	handler http.Handler
	suffix  string
	userIDs []string
}

func newIntegrationEnv(t *testing.T) *integrationEnv {
	t.Helper()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run database-backed tests")
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
	server := New(pool, config.Config{CorsOrigins: "http://localhost:3000", MediaUploadDir: t.TempDir(), DemoPaymentsEnabled: true, AppEnv: "test"})
	env := &integrationEnv{t: t, ctx: ctx, pool: pool, server: server, handler: server.Handler(), suffix: suffix[:10]}
	t.Cleanup(env.cleanup)
	return env
}

func (e *integrationEnv) cleanup() {
	for _, id := range e.userIDs {
		for _, statement := range []string{
			`DELETE FROM notifications WHERE user_id=$1`,
			`DELETE FROM messages WHERE sender_id=$1 OR recipient_id=$1`,
			`DELETE FROM maintenance_requests WHERE tenant_id=$1 OR landlord_id=$1`,
			`DELETE FROM rental_agreements WHERE tenant_id=$1 OR landlord_id=$1`,
			`UPDATE subscriptions SET superseded_by=NULL WHERE user_id=$1`,
			`DELETE FROM subscriptions WHERE user_id=$1`,
			`DELETE FROM listing_upload_slots WHERE owner_id=$1`,
			`DELETE FROM listing_upload_purchases WHERE owner_id=$1`,
			`DELETE FROM listing_subscriptions WHERE owner_id=$1`,
			`DELETE FROM payments WHERE user_id=$1`,
			`DELETE FROM listings WHERE owner_id=$1`,
			`DELETE FROM audit_logs WHERE actor_id=$1`,
		} {
			_, _ = e.pool.Exec(e.ctx, statement, id)
		}
		_, _ = e.pool.Exec(e.ctx, `UPDATE plan_versions SET created_by=NULL WHERE created_by=$1`, id)
		_, _ = e.pool.Exec(e.ctx, `UPDATE platform_settings SET updated_by=NULL WHERE updated_by=$1`, id)
		_, _ = e.pool.Exec(e.ctx, `DELETE FROM users WHERE id=$1`, id)
	}
}

// user creates an account with a session and returns (id, token).
func (e *integrationEnv) user(name, role, workspaceKind string) (string, string) {
	e.t.Helper()
	token, _ := randomToken()
	phone := "+2507" + token[:8]
	var id string
	if err := e.pool.QueryRow(e.ctx, `INSERT INTO users(name,phone,role,workspace_kind,verified_at,phone_verified_at) VALUES($1,$2,$3,$4,NOW(),NOW()) RETURNING id`, name+" "+e.suffix, phone, role, workspaceKind).Scan(&id); err != nil {
		e.t.Fatal(err)
	}
	if _, err := e.pool.Exec(e.ctx, `INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')`, id, hash(token)); err != nil {
		e.t.Fatal(err)
	}
	e.userIDs = append(e.userIDs, id)
	return id, token
}

func (e *integrationEnv) do(method, path, token string, body any) (int, map[string]any) {
	e.t.Helper()
	var reader *bytes.Reader
	if body != nil {
		payload, _ := json.Marshal(body)
		reader = bytes.NewReader(payload)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res := httptest.NewRecorder()
	e.handler.ServeHTTP(res, req)
	decoded := map[string]any{}
	_ = json.Unmarshal(res.Body.Bytes(), &decoded)
	return res.Code, decoded
}

func (e *integrationEnv) draft(token, title string) string {
	e.t.Helper()
	code, body := e.do(http.MethodPost, "/api/v1/listings", token, map[string]any{"category": "house", "transaction_type": "rent", "title": title + " " + e.suffix, "description": "integration", "price": 250000, "currency": "RWF", "province": "City of Kigali", "district": "Gasabo", "sector": "Kacyiru", "media": []any{}})
	if code != http.StatusCreated {
		e.t.Fatalf("create draft: %d %v", code, body)
	}
	return body["id"].(string)
}

// setPlans configures the landlord plans used by these tests through the
// admin API (so validation and auditing are exercised) and restores the
// original rows afterwards.
func (e *integrationEnv) setPlans(adminToken string, plans []map[string]any) {
	e.t.Helper()
	var snapshot []byte
	if err := e.pool.QueryRow(e.ctx, `SELECT COALESCE(json_agg(p),'[]') FROM plan_versions p WHERE business_role='landlord' AND is_current`).Scan(&snapshot); err != nil {
		e.t.Fatal(err)
	}
	e.t.Cleanup(func() {
		// Restore: make the original versions current again.
		var originals []struct {
			ID string `json:"id"`
		}
		_ = json.Unmarshal(snapshot, &originals)
		_, _ = e.pool.Exec(e.ctx, `UPDATE plan_versions SET is_current=FALSE WHERE business_role='landlord'`)
		for _, original := range originals {
			_, _ = e.pool.Exec(e.ctx, `UPDATE plan_versions SET is_current=TRUE WHERE id=$1`, original.ID)
		}
	})
	if code, body := e.do(http.MethodPut, "/api/v1/admin/business-plans", adminToken, map[string]any{"plans": plans}); code != http.StatusOK {
		e.t.Fatalf("configure plans: %d %v", code, body)
	}
}

func landlordPlan(tier string, limit any, price float64) map[string]any {
	return map[string]any{"business_role": "landlord", "tier": tier, "label": tier, "price": price, "period_days": 30, "listing_limit": limit, "fair_use_listing_cap": 500, "photo_limit_per_listing": 10, "features": []string{"photo_uploads"}, "enabled": true}
}

func TestBusinessPlanLifecycleIntegration(t *testing.T) {
	env := newIntegrationEnv(t)
	_, adminToken := env.user("Plan Admin", "admin", "")
	landlordID, landlordToken := env.user("Plan Landlord", "property_owner", "landlord")

	// Seeded plans are disabled: nothing can be bought until an admin enables it.
	if code, _ := env.do(http.MethodPost, "/api/v1/business/subscriptions", landlordToken, map[string]any{"tier": "silver", "payment_method": "demo", "idempotency_key": "k0-" + env.suffix}); code != http.StatusNotFound {
		t.Fatalf("buying a disabled plan: status %d; want 404", code)
	}
	// Gold may not be enabled with the same allowance as Silver.
	if code, _ := env.do(http.MethodPut, "/api/v1/admin/business-plans", adminToken, map[string]any{"plans": []map[string]any{landlordPlan("silver", 2, 1000), landlordPlan("gold", 2, 2000)}}); code != http.StatusBadRequest {
		t.Fatalf("gold == silver limit: status %d; want 400", code)
	}
	env.setPlans(adminToken, []map[string]any{landlordPlan("silver", 2, 1000), landlordPlan("gold", 4, 2000)})
	var audits int
	_ = env.pool.QueryRow(env.ctx, `SELECT COUNT(*) FROM audit_logs a JOIN users u ON u.id=a.actor_id WHERE a.action='plan.updated' AND u.role='admin' AND a.created_at > NOW()-INTERVAL '1 minute'`).Scan(&audits)
	if audits < 2 {
		t.Fatalf("plan changes must be audit-logged, found %d", audits)
	}
	if code, body := env.do(http.MethodGet, "/api/v1/plans?role=landlord", "", nil); code != http.StatusOK || len(body["plans"].([]any)) < 2 {
		t.Fatalf("public plans: %d %v", code, body)
	}

	// Buy Silver (demo provider) and check the entitlement is what the
	// backend reports everywhere.
	code, body := env.do(http.MethodPost, "/api/v1/business/subscriptions", landlordToken, map[string]any{"tier": "silver", "payment_method": "demo", "idempotency_key": "k1-" + env.suffix})
	if code != http.StatusOK || body["status"] != "active" {
		t.Fatalf("buy silver: %d %v", code, body)
	}
	if code, body := env.do(http.MethodPost, "/api/v1/business/subscriptions", landlordToken, map[string]any{"tier": "silver", "payment_method": "demo", "idempotency_key": "k1-" + env.suffix}); code != http.StatusOK || body["idempotent_replay"] != true {
		t.Fatalf("idempotent replay: %d %v", code, body)
	}
	if code, body := env.do(http.MethodGet, "/api/v1/subscription", landlordToken, nil); code != http.StatusOK || body["tier"] != "silver" {
		t.Fatalf("/subscription must report the real plan: %d %v", code, body)
	}

	// Two listings publish on the plan; the third needs another payment.
	first, second, third := env.draft(landlordToken, "Plan one"), env.draft(landlordToken, "Plan two"), env.draft(landlordToken, "Plan three")
	for _, id := range []string{first, second} {
		if code, body := env.do(http.MethodPost, "/api/v1/listings/"+id+"/publish", landlordToken, nil); code != http.StatusOK || body["entitlement"] != "plan" {
			t.Fatalf("publish on plan: %d %v", code, body)
		}
	}
	if code, _ := env.do(http.MethodPost, "/api/v1/listings/"+third+"/publish", landlordToken, nil); code != http.StatusPaymentRequired {
		t.Fatalf("publish beyond allowance: status %d; want 402", code)
	}

	// Upgrade to Gold: immediate, previous plan superseded, allowance grows.
	if code, body := env.do(http.MethodPost, "/api/v1/business/subscriptions", landlordToken, map[string]any{"tier": "gold", "payment_method": "demo", "idempotency_key": "k2-" + env.suffix}); code != http.StatusOK || body["change_kind"] != "upgrade" {
		t.Fatalf("upgrade: %d %v", code, body)
	}
	var superseded int
	_ = env.pool.QueryRow(env.ctx, `SELECT COUNT(*) FROM subscriptions WHERE user_id=$1 AND status='superseded'`, landlordID).Scan(&superseded)
	if superseded != 1 {
		t.Fatalf("silver should be superseded, got %d", superseded)
	}
	// While the plan has room, a per-listing charge is refused (no double charge).
	if code, body := env.do(http.MethodPost, "/api/v1/listings/"+third+"/demo-payment", landlordToken, map[string]any{"email": "owner@example.com", "plan": "silver", "requested_status": "published"}); code != http.StatusConflict || body["code"] != "covered_by_plan" {
		t.Fatalf("double charge guard: %d %v", code, body)
	}
	if code, body := env.do(http.MethodGet, "/api/v1/listing-fee?plan=silver", landlordToken, nil); code != http.StatusOK || body["covered_by_plan"] != true {
		t.Fatalf("fee quote should report plan coverage: %d %v", code, body)
	}
	if code, body := env.do(http.MethodPost, "/api/v1/listings/"+third+"/publish", landlordToken, nil); code != http.StatusOK || body["entitlement"] != "plan" {
		t.Fatalf("publish after upgrade: %d %v", code, body)
	}

	// Renewing Gold is scheduled after the current period, not overlapping it.
	if code, body := env.do(http.MethodPost, "/api/v1/business/subscriptions", landlordToken, map[string]any{"tier": "gold", "payment_method": "demo", "idempotency_key": "k3-" + env.suffix}); code != http.StatusOK || body["change_kind"] != "renewal" {
		t.Fatalf("renewal: %d %v", code, body)
	}
	var scheduled int
	_ = env.pool.QueryRow(env.ctx, `SELECT COUNT(*) FROM subscriptions WHERE user_id=$1 AND status='active' AND starts_at > NOW()`, landlordID).Scan(&scheduled)
	if scheduled != 1 {
		t.Fatalf("renewal should be scheduled after the current period, got %d", scheduled)
	}
	if code, _ := env.do(http.MethodPost, "/api/v1/business/subscriptions", landlordToken, map[string]any{"tier": "silver", "payment_method": "demo", "idempotency_key": "k4-" + env.suffix}); code != http.StatusConflict {
		t.Fatalf("second scheduled plan: status %d; want 409", code)
	}

	// Lapse every plan with no grace period: covered listings are paused, not deleted.
	if _, err := env.pool.Exec(env.ctx, `UPDATE subscriptions SET starts_at=NOW()-INTERVAL '40 days', ends_at=NOW()-INTERVAL '1 second' WHERE user_id=$1 AND status='active'`, landlordID); err != nil {
		t.Fatal(err)
	}
	if _, err := env.pool.Exec(env.ctx, `UPDATE platform_settings SET value='0' WHERE key='subscription_grace_days'`); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = env.pool.Exec(env.ctx, `UPDATE platform_settings SET value='3' WHERE key='subscription_grace_days'`) })
	if err := env.server.expireBusinessSubscriptions(env.ctx); err != nil {
		t.Fatal(err)
	}
	var paused, deleted int
	_ = env.pool.QueryRow(env.ctx, `SELECT COUNT(*) FILTER (WHERE status='paused' AND paused_reason='plan_expired'), COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) FROM listings WHERE owner_id=$1`, landlordID).Scan(&paused, &deleted)
	if paused != 3 || deleted != 0 {
		t.Fatalf("after lapse: paused=%d deleted=%d; want 3 paused, 0 deleted", paused, deleted)
	}
	if code, _ := env.do(http.MethodPatch, "/api/v1/listings/"+first, landlordToken, map[string]any{"status": "published"}); code != http.StatusPaymentRequired {
		t.Fatalf("plan-paused listing must not be republished without an entitlement: %d", code)
	}
}

func TestPlanDowngradePausesNewestListingsIntegration(t *testing.T) {
	env := newIntegrationEnv(t)
	_, adminToken := env.user("Downgrade Admin", "admin", "")
	landlordID, landlordToken := env.user("Downgrade Landlord", "property_owner", "landlord")
	env.setPlans(adminToken, []map[string]any{landlordPlan("silver", 1, 1000), landlordPlan("gold", 3, 2000)})
	if code, body := env.do(http.MethodPost, "/api/v1/business/subscriptions", landlordToken, map[string]any{"tier": "gold", "payment_method": "demo", "idempotency_key": "d1-" + env.suffix}); code != http.StatusOK {
		t.Fatalf("buy gold: %d %v", code, body)
	}
	ids := []string{env.draft(landlordToken, "Oldest"), env.draft(landlordToken, "Middle"), env.draft(landlordToken, "Newest")}
	for _, id := range ids {
		if code, body := env.do(http.MethodPost, "/api/v1/listings/"+id+"/publish", landlordToken, nil); code != http.StatusOK {
			t.Fatalf("publish: %d %v", code, body)
		}
	}
	// Simulate the scheduled downgrade starting: Gold ended, Silver (limit 1) active.
	if _, err := env.pool.Exec(env.ctx, `UPDATE subscriptions SET status='expired', ends_at=NOW()-INTERVAL '1 second' WHERE user_id=$1`, landlordID); err != nil {
		t.Fatal(err)
	}
	if code, body := env.do(http.MethodPost, "/api/v1/business/subscriptions", landlordToken, map[string]any{"tier": "silver", "payment_method": "demo", "idempotency_key": "d2-" + env.suffix}); code != http.StatusOK {
		t.Fatalf("buy silver: %d %v", code, body)
	}
	if err := env.server.expireBusinessSubscriptions(env.ctx); err != nil {
		t.Fatal(err)
	}
	statuses := map[string]string{}
	for _, id := range ids {
		var status string
		_ = env.pool.QueryRow(env.ctx, `SELECT status FROM listings WHERE id=$1`, id).Scan(&status)
		statuses[id] = status
	}
	if statuses[ids[0]] != "published" || statuses[ids[1]] != "paused" || statuses[ids[2]] != "paused" {
		t.Fatalf("downgrade should keep the oldest listing and pause newer ones: %v", statuses)
	}
}

func TestListingFeeMostSpecificRuleWinsIntegration(t *testing.T) {
	env := newIntegrationEnv(t)
	_, adminToken := env.user("Fee Admin", "admin", "")
	_, ownerToken := env.user("Fee Owner", "property_owner", "property_owner")
	t.Cleanup(func() {
		_, _ = env.pool.Exec(env.ctx, `DELETE FROM marketplace_listing_fee_rules WHERE role='property_owner' AND category='land'`)
	})
	_, genericBefore := env.do(http.MethodGet, "/api/v1/listing-fee?price=250000&category=house", ownerToken, nil)
	// A fixed 5,000 RWF fee for land listings in the lowest price band,
	// saved through the admin endpoint (exercises the new upsert key).
	rule := map[string]any{"role": "property_owner", "category": "land", "price_min": 0, "price_max": 300000, "rate_percent": 0, "fixed_fee": 5000, "expiry_days": 90, "enabled": true}
	if code, body := env.do(http.MethodPatch, "/api/v1/admin/marketplace-pricing", adminToken, map[string]any{"fees": []any{rule}}); code != http.StatusOK {
		t.Fatalf("save category rule: %d %v", code, body)
	}
	// Saving the same rule again updates it in place instead of duplicating.
	if code, body := env.do(http.MethodPatch, "/api/v1/admin/marketplace-pricing", adminToken, map[string]any{"fees": []any{rule}}); code != http.StatusOK {
		t.Fatalf("re-save category rule: %d %v", code, body)
	}
	var count int
	_ = env.pool.QueryRow(env.ctx, `SELECT COUNT(*) FROM marketplace_listing_fee_rules WHERE role='property_owner' AND category='land'`).Scan(&count)
	if count != 1 {
		t.Fatalf("category rule rows = %d; want 1", count)
	}
	if code, body := env.do(http.MethodGet, "/api/v1/listing-fee?price=250000&category=land", ownerToken, nil); code != http.StatusOK || body["fee"] != float64(5000) {
		t.Fatalf("land quote: %d %v; want fee 5000", code, body)
	}
	if code, body := env.do(http.MethodGet, "/api/v1/listing-fee?price=250000&category=house", ownerToken, nil); code != http.StatusOK || body["fee"] != genericBefore["fee"] {
		t.Fatalf("house quote changed: %d %v; want %v", code, body, genericBefore["fee"])
	}
}

func TestMessagingAndMaintenanceRequireARelationshipIntegration(t *testing.T) {
	env := newIntegrationEnv(t)
	ownerID, ownerToken := env.user("Msg Owner", "komisiyoneri", "")
	strangerID, strangerToken := env.user("Msg Stranger", "client", "")
	enquirerID, enquirerToken := env.user("Msg Enquirer", "client", "")
	tenantID, tenantToken := env.user("Msg Tenant", "tenant", "")

	// No listing and no prior contact: refused.
	if code, _ := env.do(http.MethodPost, "/api/v1/messages", strangerToken, map[string]any{"recipient_id": ownerID, "body": "hi"}); code != http.StatusForbidden {
		t.Fatalf("cold message without listing: %d; want 403", code)
	}
	listingID := env.draft(ownerToken, "Messaging listing")
	if _, err := env.pool.Exec(env.ctx, `UPDATE listings SET status='published' WHERE id=$1`, listingID); err != nil {
		t.Fatal(err)
	}
	// The owner cannot use their listing to message someone who never asked.
	if code, _ := env.do(http.MethodPost, "/api/v1/messages", ownerToken, map[string]any{"listing_id": listingID, "recipient_id": strangerID, "body": "spam"}); code != http.StatusForbidden {
		t.Fatalf("owner cold message: %d; want 403", code)
	}
	// An enquiry about a published listing works, and the owner may reply.
	if code, body := env.do(http.MethodPost, "/api/v1/messages", enquirerToken, map[string]any{"listing_id": listingID, "body": "Is it available?"}); code != http.StatusCreated {
		t.Fatalf("enquiry: %d %v", code, body)
	}
	if code, body := env.do(http.MethodPost, "/api/v1/messages", ownerToken, map[string]any{"listing_id": listingID, "recipient_id": enquirerID, "body": "Yes"}); code != http.StatusCreated {
		t.Fatalf("owner reply: %d %v", code, body)
	}

	// Maintenance: only tenants with an agreement may file with that landlord.
	if code, _ := env.do(http.MethodPost, "/api/v1/maintenance", tenantToken, map[string]any{"landlord_id": ownerID, "title": "Leak", "description": "Kitchen tap"}); code != http.StatusForbidden {
		t.Fatalf("maintenance without agreement: %d; want 403", code)
	}
	if _, err := env.pool.Exec(env.ctx, `INSERT INTO rental_agreements(tenant_id,landlord_id,rent_amount,status) VALUES($1,$2,100000,'active')`, tenantID, ownerID); err != nil {
		t.Fatal(err)
	}
	if code, body := env.do(http.MethodPost, "/api/v1/maintenance", tenantToken, map[string]any{"landlord_id": ownerID, "title": "Leak", "description": "Kitchen tap"}); code != http.StatusCreated {
		t.Fatalf("maintenance with agreement: %d %v", code, body)
	}
	var notified bool
	_ = env.pool.QueryRow(env.ctx, `SELECT EXISTS(SELECT 1 FROM notifications WHERE user_id=$1 AND type='maintenance_requested')`, ownerID).Scan(&notified)
	if !notified {
		t.Fatal("landlord should be notified of the repair request")
	}
	// Landlord and tenant may message each other directly.
	if code, body := env.do(http.MethodPost, "/api/v1/messages", tenantToken, map[string]any{"recipient_id": ownerID, "body": "Thanks"}); code != http.StatusCreated {
		t.Fatalf("tenant to landlord: %d %v", code, body)
	}
}
