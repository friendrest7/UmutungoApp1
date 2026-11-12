package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/umutungo/umutungo/backend/internal/config"
)

// Database-backed tests for UMU-AUTH-002 (email change keeps verified status)
// and UMU-CFG-001 (development logins and demo payments in production).
// Like the other integration tests they run only when TEST_DATABASE_URL
// points at a disposable database. No SMS, email or payment provider is
// contacted: codes go to otpDeliver and Flutterwave is faked in-process.

// rawCall sends a request from its own client IP, so the per-IP OTP limits of
// one step don't affect the next.
type rawCaller struct {
	t       *testing.T
	handler http.Handler
	prefix  int64
	ip      int
}

func newRawCaller(env *integrationEnv) *rawCaller {
	var n int64
	fmt.Sscanf(env.suffix[:6], "%x", &n)
	return &rawCaller{t: env.t, handler: env.handler, prefix: n}
}

func (c *rawCaller) do(method, path, token string, body any) (*httptest.ResponseRecorder, map[string]any) {
	c.t.Helper()
	c.ip++
	var reader io.Reader = http.NoBody
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, reader)
	req.RemoteAddr = fmt.Sprintf("10.%d.%d.%d:1000", (c.prefix>>8)&255, c.prefix&255, c.ip%250+1)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	c.handler.ServeHTTP(rec, req)
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec, out
}

func enableTestEmailDelivery(env *integrationEnv) chan string {
	env.server.cfg.OTPHMACSecret = "integration-test-secret-at-least-32-chars"
	env.server.cfg.SMTPHost, env.server.cfg.SMTPUsername, env.server.cfg.SMTPPassword, env.server.cfg.EmailFrom = "smtp.test", "u", "p", "Umutungo <no-reply@example.com>"
	codes := make(chan string, 10)
	env.server.otpDeliver = func(_, _, code string) { codes <- code }
	return codes
}

func TestEmailChangeRequiresVerificationIntegration(t *testing.T) {
	env := newIntegrationEnv(t)
	codes := enableTestEmailDelivery(env)
	api := newRawCaller(env)
	nextCode := func() string {
		t.Helper()
		select {
		case c := <-codes:
			return c
		case <-time.After(5 * time.Second):
			t.Fatal("no code was delivered")
			return ""
		}
	}
	noCode := func() {
		t.Helper()
		select {
		case <-codes:
			t.Fatal("a code was delivered but should not have been")
		case <-time.After(300 * time.Millisecond):
		}
	}
	type row struct {
		Name, Email string
		Verified    bool
	}
	load := func(id string) row {
		t.Helper()
		var r row
		if err := env.pool.QueryRow(env.ctx, `SELECT name,COALESCE(email,''),email_verified_at IS NOT NULL FROM users WHERE id=$1`, id).Scan(&r.Name, &r.Email, &r.Verified); err != nil {
			t.Fatal(err)
		}
		return r
	}

	aID, aToken := env.user("Email A", "client", "")
	bID, bToken := env.user("Email B", "client", "")
	oldA := "old-a-" + env.suffix + "@example.com"
	newA := "new-a-" + env.suffix + "@example.com"
	if _, err := env.pool.Exec(env.ctx, `UPDATE users SET email=$2, email_verified_at=NOW() WHERE id=$1`, aID, oldA); err != nil {
		t.Fatal(err)
	}
	before := load(aID)

	// 1. PATCH /me cannot change the address, and client-sent verification
	// flags are ignored. Nothing in the request is applied.
	rec, body := api.do("PATCH", "/api/v1/me", aToken, map[string]any{"name": "Renamed", "email": newA, "email_verified": true, "email_verified_at": "2020-01-01T00:00:00Z"})
	if rec.Code != http.StatusConflict || body["code"] != "email_verification_required" {
		t.Fatalf("PATCH new email: %d %v; want 409 email_verification_required", rec.Code, body)
	}
	if got := load(aID); got != before {
		t.Fatalf("rejected PATCH changed the account: %+v -> %+v", before, got)
	}
	// Clearing the address is a change too.
	if rec, _ := api.do("PATCH", "/api/v1/me", aToken, map[string]any{"email": ""}); rec.Code != http.StatusConflict {
		t.Fatalf("PATCH empty email: %d; want 409", rec.Code)
	}

	// 2. Sending the current address back (profile forms send every field)
	// is fine and keeps it verified.
	rec, body = api.do("PATCH", "/api/v1/me", aToken, map[string]any{"name": "Renamed A", "email": strings.ToUpper(oldA)})
	if user, _ := body["user"].(map[string]any); rec.Code != http.StatusOK || user["email"] != oldA || user["email_verified"] != true || user["name"] != "Renamed A" {
		t.Fatalf("PATCH unchanged email: %d %v", rec.Code, body)
	}

	// 3. Client-supplied verification flags alone change nothing.
	if rec, body := api.do("PATCH", "/api/v1/me", aToken, map[string]any{"bio": "hello", "email_verified": false, "email_verified_at": nil}); rec.Code != http.StatusOK {
		t.Fatalf("PATCH with flags: %d %v", rec.Code, body)
	}
	if got := load(aID); !got.Verified || got.Email != oldA {
		t.Fatalf("client flags were trusted: %+v", got)
	}

	// 4. Another user cannot touch A's address: B's PATCH only ever targets B,
	// and asking for A's address is refused like any change.
	if rec, _ := api.do("PATCH", "/api/v1/me", bToken, map[string]any{"email": oldA}); rec.Code != http.StatusConflict {
		t.Fatalf("B PATCH to A's email: %d; want 409", rec.Code)
	}
	if got := load(aID); got.Email != oldA || !got.Verified {
		t.Fatalf("A changed by B's request: %+v", got)
	}

	// 5. The verification flow: request a code for the new address. Until it
	// is entered the old verified address stays in place.
	if rec, body := api.do("POST", "/api/v1/verification/send", aToken, map[string]string{"purpose": "verify_email", "destination": newA}); rec.Code != http.StatusOK {
		t.Fatalf("send code: %d %v", rec.Code, body)
	}
	code := nextCode()
	if rec, body := api.do("GET", "/api/v1/me", aToken, nil); rec.Code != http.StatusOK {
		t.Fatalf("GET /me: %d", rec.Code)
	} else if user, _ := body["user"].(map[string]any); user["email"] != oldA || user["email_verified"] != true {
		t.Fatalf("pending address applied too early: %v", user)
	}

	// 6. The challenge belongs to A: B can't use A's code for A's new address.
	if rec, _ := api.do("POST", "/api/v1/verification/verify", bToken, map[string]string{"purpose": "verify_email", "destination": newA, "code": code}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("B using A's code: %d; want 401", rec.Code)
	}
	if got := load(bID); got.Email == newA {
		t.Fatal("B obtained A's pending address")
	}

	// 7. A enters the code: the new address becomes active and verified.
	rec, body = api.do("POST", "/api/v1/verification/verify", aToken, map[string]string{"purpose": "verify_email", "destination": newA, "code": code})
	if user, _ := body["user"].(map[string]any); rec.Code != http.StatusOK || user["email"] != newA || user["email_verified"] != true {
		t.Fatalf("verify new email: %d %v", rec.Code, body)
	}
	// 8. The code is single-use.
	if rec, _ := api.do("POST", "/api/v1/verification/verify", aToken, map[string]string{"purpose": "verify_email", "destination": newA, "code": code}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("reused code: %d; want 401", rec.Code)
	}

	// 9. A verified address can't be claimed by a second account: B gets the
	// usual reply but no code is sent. (Age the earlier send so the existing
	// one-per-minute limit on this address doesn't answer first.)
	if _, err := env.pool.Exec(env.ctx, `UPDATE otp_send_events SET created_at = created_at - INTERVAL '2 minutes'`); err != nil {
		t.Fatal(err)
	}
	if rec, body := api.do("POST", "/api/v1/verification/send", bToken, map[string]string{"purpose": "verify_email", "destination": newA}); rec.Code != http.StatusOK {
		t.Fatalf("B send for taken address: %d %v", rec.Code, body)
	}
	noCode()

	// 10. And if another account verifies an address after B's code was sent,
	// B's verification is refused rather than creating a second verified copy.
	contested := "contested-" + env.suffix + "@example.com"
	if rec, body := api.do("POST", "/api/v1/verification/send", bToken, map[string]string{"purpose": "verify_email", "destination": contested}); rec.Code != http.StatusOK {
		t.Fatalf("B send contested: %d %v", rec.Code, body)
	}
	bCode := nextCode()
	if _, err := env.pool.Exec(env.ctx, `UPDATE users SET email=$2, email_verified_at=NOW() WHERE id=$1`, aID, contested); err != nil {
		t.Fatal(err)
	}
	if rec, body := api.do("POST", "/api/v1/verification/verify", bToken, map[string]string{"purpose": "verify_email", "destination": contested, "code": bCode}); rec.Code != http.StatusConflict {
		t.Fatalf("B verifying an address A verified meanwhile: %d %v; want 409", rec.Code, body)
	}
	var copies int
	_ = env.pool.QueryRow(env.ctx, `SELECT COUNT(*) FROM users WHERE LOWER(email)=LOWER($1) AND email_verified_at IS NOT NULL`, contested).Scan(&copies)
	if copies != 1 {
		t.Fatalf("verified copies of %s: %d; want 1", contested, copies)
	}
}

func TestDevLoginOnlyInDevelopmentIntegration(t *testing.T) {
	env := newIntegrationEnv(t)
	const account = "owner@umutungo.test"
	var existed bool
	_ = env.pool.QueryRow(env.ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email)=$1)`, account).Scan(&existed)
	countSessions := func() int {
		var n int
		_ = env.pool.QueryRow(env.ctx, `SELECT COUNT(*) FROM sessions s JOIN users u ON u.id=s.user_id WHERE LOWER(u.email)=$1`, account).Scan(&n)
		return n
	}

	// Production, even with the development flags set by mistake: no route,
	// no session, no account created.
	env.server.cfg.AppEnv, env.server.cfg.TestLoginEnabled = config.EnvProduction, true
	api := &rawCaller{t: t, handler: env.server.Handler()}
	sessionsBefore := countSessions()
	if rec, _ := api.do("POST", "/api/v1/auth/dev-login", "", map[string]string{"email": account, "password": "Owner123!"}); rec.Code != http.StatusNotFound {
		t.Fatalf("dev-login in production: %d; want 404", rec.Code)
	}
	if rec, _ := api.do("POST", "/api/v1/auth/dev-admin", "", map[string]string{"email": "admin@umutungo.test", "password": "Admin123!"}); rec.Code != http.StatusNotFound {
		t.Fatalf("dev-admin in production: %d; want 404", rec.Code)
	}
	if countSessions() != sessionsBefore {
		t.Fatal("a production dev-login request created a session")
	}

	// Development: works by email alone; a password is neither needed nor checked.
	env.server.cfg.AppEnv = config.EnvDevelopment
	api.handler = env.server.Handler()
	rec, body := api.do("POST", "/api/v1/auth/dev-login", "", map[string]string{"email": account, "password": "not-a-password"})
	token, _ := body["access_token"].(string)
	t.Cleanup(func() {
		if token != "" {
			_, _ = env.pool.Exec(env.ctx, `DELETE FROM sessions WHERE token_hash=$1`, hash(token))
		}
		if !existed {
			var id string
			if env.pool.QueryRow(env.ctx, `SELECT id FROM users WHERE LOWER(email)=$1`, account).Scan(&id) == nil {
				env.userIDs = append(env.userIDs, id)
				env.cleanup()
			}
		}
	})
	if rec.Code != http.StatusOK || token == "" {
		t.Fatalf("dev-login in development: %d %v", rec.Code, body)
	}
}

func TestDemoPaymentsRefusedInProductionIntegration(t *testing.T) {
	env := newIntegrationEnv(t)
	_, adminToken := env.user("Prod Admin", "admin", "")
	landlordID, landlordToken := env.user("Prod Landlord", "property_owner", "landlord")
	env.setPlans(adminToken, []map[string]any{landlordPlan("silver", 2, 1000), landlordPlan("gold", 4, 2000)})

	// A production server whose DEMO_PAYMENTS_ENABLED was left on by mistake.
	env.server.cfg.AppEnv, env.server.cfg.DemoPaymentsEnabled = config.EnvProduction, true
	api := &rawCaller{t: t, handler: env.server.Handler()}

	if rec, body := api.do("POST", "/api/v1/business/subscriptions", landlordToken, map[string]any{"tier": "silver", "payment_method": "demo", "idempotency_key": "prod-demo-" + env.suffix}); rec.Code != http.StatusBadRequest {
		t.Fatalf("demo plan purchase in production: %d %v; want 400", rec.Code, body)
	}
	if rec, body := api.do("POST", "/api/v1/owner/upgrades", landlordToken, map[string]any{"plan": "silver", "provider": "demo", "idempotency_key": "prod-upgrade-" + env.suffix}); rec.Code != http.StatusForbidden && rec.Code != http.StatusBadRequest {
		t.Fatalf("demo owner upgrade in production: %d %v; want 403/400", rec.Code, body)
	}
	if rec, _ := api.do("POST", "/api/v1/listings/00000000-0000-0000-0000-000000000000/demo-payment", landlordToken, map[string]any{}); rec.Code != http.StatusNotFound {
		t.Fatalf("demo listing payment in production: %d; want 404", rec.Code)
	}
	var active int
	_ = env.pool.QueryRow(env.ctx, `SELECT (SELECT COUNT(*) FROM subscriptions WHERE user_id=$1 AND status='active') + (SELECT COUNT(*) FROM owner_upgrade_purchases WHERE owner_id=$1 AND status='active')`, landlordID).Scan(&active)
	if active != 0 {
		t.Fatalf("a demo payment activated %d plan(s) in production", active)
	}
}

// fakeFlutterwave answers the two Flutterwave calls the plan checkout makes and
// refuses every other outbound request, so the test can never reach a real
// provider.
type fakeFlutterwave struct {
	mu       sync.Mutex
	verified map[string]flutterwaveVerification // by transaction id
}

func (f *fakeFlutterwave) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.URL.Host != "api.flutterwave.com" {
		return nil, errors.New("test: outbound request blocked: " + req.URL.Host)
	}
	reply := func(v any) (*http.Response, error) {
		raw, _ := json.Marshal(v)
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(bytes.NewReader(raw)), Request: req}, nil
	}
	switch {
	case req.Method == http.MethodPost && req.URL.Path == "/v3/payments":
		return reply(map[string]any{"status": "success", "data": map[string]string{"link": "https://checkout.example.test/pay"}})
	case req.Method == http.MethodGet && strings.HasPrefix(req.URL.Path, "/v3/transactions/") && strings.HasSuffix(req.URL.Path, "/verify"):
		id := strings.TrimSuffix(strings.TrimPrefix(req.URL.Path, "/v3/transactions/"), "/verify")
		f.mu.Lock()
		v, ok := f.verified[id]
		f.mu.Unlock()
		if !ok {
			return &http.Response{StatusCode: http.StatusNotFound, Body: io.NopCloser(strings.NewReader(`{"status":"error"}`)), Request: req}, nil
		}
		return reply(map[string]any{"status": "success", "data": v})
	}
	return nil, errors.New("test: unexpected Flutterwave call " + req.Method + " " + req.URL.Path)
}

// Real (provider-verified) plan payments must keep working in production.
func TestProductionPlanPaymentStillActivatesAfterVerificationIntegration(t *testing.T) {
	env := newIntegrationEnv(t)
	fake := &fakeFlutterwave{verified: map[string]flutterwaveVerification{}}
	original := http.DefaultTransport
	http.DefaultTransport = fake
	t.Cleanup(func() { http.DefaultTransport = original })

	_, adminToken := env.user("Pay Admin", "admin", "")
	landlordID, landlordToken := env.user("Pay Landlord", "property_owner", "landlord")
	env.setPlans(adminToken, []map[string]any{landlordPlan("silver", 2, 1000), landlordPlan("gold", 4, 2000)})
	env.server.cfg.AppEnv, env.server.cfg.DemoPaymentsEnabled = config.EnvProduction, false
	env.server.cfg.FlutterwaveSecretKey = "FLWSECK_TEST-not-a-real-key"
	env.server.cfg.FrontendBaseURL, env.server.cfg.BackendPublicURL = "https://frontend.example.test", "https://api.example.test"
	api := &rawCaller{t: t, handler: env.server.Handler()}

	rec, body := api.do("POST", "/api/v1/business/subscriptions", landlordToken, map[string]any{"tier": "silver", "payment_method": "card", "email": "payer@example.com", "idempotency_key": "prod-card-" + env.suffix})
	if rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("card checkout: %d %v", rec.Code, body)
	}
	var paymentID, txRef string
	var amount float64
	if err := env.pool.QueryRow(env.ctx, `SELECT id::text,provider_reference,amount FROM payments WHERE user_id=$1 AND provider='flutterwave' ORDER BY created_at DESC LIMIT 1`, landlordID).Scan(&paymentID, &txRef, &amount); err != nil {
		t.Fatalf("no Flutterwave payment recorded: %v", err)
	}
	activeSubscriptions := func() int {
		var n int
		_ = env.pool.QueryRow(env.ctx, `SELECT COUNT(*) FROM subscriptions WHERE user_id=$1 AND status='active'`, landlordID).Scan(&n)
		return n
	}
	returnFrom := func(transactionID string) string {
		t.Helper()
		q := url.Values{"tx_ref": {txRef}, "transaction_id": {transactionID}, "status": {"successful"}}
		rec, _ := api.do("GET", "/api/v1/business/subscription-payments/verify?"+q.Encode(), "", nil)
		if rec.Code != http.StatusSeeOther {
			t.Fatalf("payment return: %d", rec.Code)
		}
		return rec.Header().Get("Location")
	}

	// The provider reports a different amount: nothing is activated.
	fake.verified["1001"] = flutterwaveVerification{ID: 1001, TxRef: txRef, Status: "successful", Amount: amount + 1, Currency: "RWF"}
	if location := returnFrom("1001"); !strings.Contains(location, "payment=pending") || activeSubscriptions() != 0 {
		t.Fatalf("mismatched amount must not activate: %s, active=%d", location, activeSubscriptions())
	}
	// The provider confirms the exact payment: the plan becomes active.
	fake.verified["1002"] = flutterwaveVerification{ID: 1002, TxRef: txRef, Status: "successful", Amount: amount, Currency: "RWF"}
	if location := returnFrom("1002"); !strings.Contains(location, "payment=successful") || activeSubscriptions() != 1 {
		t.Fatalf("verified payment must activate: %s, active=%d", location, activeSubscriptions())
	}
	var status string
	_ = env.pool.QueryRow(env.ctx, `SELECT status FROM payments WHERE id=$1`, paymentID).Scan(&status)
	if status != "successful" {
		t.Fatalf("payment status %q; want successful", status)
	}
}
