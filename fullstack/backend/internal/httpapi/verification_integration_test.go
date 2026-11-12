package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"
	"time"
)

// Runs only when TEST_DATABASE_URL points at a disposable database
// (a separate Supabase project works). Real SMS/email is never sent.
func TestVerificationFlowAgainstDatabase(t *testing.T) {
	env := newIntegrationEnv(t)
	env.server.cfg.OTPHMACSecret = "integration-test-secret-at-least-32-chars"
	env.server.cfg.TwilioAccountSID, env.server.cfg.TwilioAuthToken, env.server.cfg.TwilioFromNumber = "test", "test", "+15005550006"
	env.server.cfg.SMTPHost, env.server.cfg.SMTPUsername, env.server.cfg.SMTPPassword, env.server.cfg.EmailFrom = "smtp.test", "u", "p", "Umutungo <no-reply@example.com>"
	codes := make(chan string, 10)
	env.server.otpDeliver = func(_, _, code string) { codes <- code }

	// A unique, valid Rwanda number per test run.
	var n int64
	fmt.Sscanf(env.suffix[:6], "%x", &n)
	phone := fmt.Sprintf("+25078%07d", n%10_000_000)
	// A second number that is never registered. It must differ from phone:
	// the per-number cooldown counts sends to unregistered numbers too.
	unknownPhone := fmt.Sprintf("+25079%07d", n%10_000_000)
	ip := 0
	call := func(method, path, token string, body any) (int, map[string]any) {
		t.Helper()
		ip++ // a fresh IP per call, so the per-IP limit doesn't mask the per-destination one
		raw, _ := json.Marshal(body)
		req := httptest.NewRequest(method, path, bytes.NewReader(raw))
		// Addresses are unique to this run, so earlier runs' limits don't apply.
		req.RemoteAddr = fmt.Sprintf("10.%d.%d.%d:1000", (n>>8)&255, n&255, ip)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rec := httptest.NewRecorder()
		env.handler.ServeHTTP(rec, req)
		var out map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		return rec.Code, out
	}
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
		case <-time.After(200 * time.Millisecond):
		}
	}

	// Login for an unregistered number: same reply, nothing sent.
	status, unknownReply := call("POST", "/api/v1/auth/request-otp", "", map[string]string{"phone": unknownPhone})
	if status != 200 {
		t.Fatalf("request-otp unknown: %d %v", status, unknownReply)
	}
	noCode()

	// Sign up -> code -> verify.
	status, signupReply := call("POST", "/api/v1/auth/register", "", map[string]string{"name": "Test User", "phone": phone, "email": "otp-" + env.suffix + "@example.com", "role": "client"})
	if status != 200 {
		t.Fatalf("register: %d %v", status, signupReply)
	}
	if signupReply["message"] != unknownReply["message"] {
		t.Fatal("signup and unknown-number replies must be identical")
	}
	code := nextCode()
	var userID string
	if err := env.pool.QueryRow(env.ctx, `SELECT id FROM users WHERE phone=$1`, phone).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	env.userIDs = append(env.userIDs, userID)

	var storedHash string
	_ = env.pool.QueryRow(env.ctx, `SELECT code_hash FROM otp_challenges WHERE user_id=$1`, userID).Scan(&storedHash)
	if storedHash == "" || storedHash == code || storedHash == hash(code) {
		t.Fatal("code must be stored as a keyed hash")
	}

	// Resend within 60 s is refused, even from a different IP.
	if status, _ := call("POST", "/api/v1/verification/resend", "", map[string]string{"purpose": "login", "destination": phone}); status != 429 {
		t.Fatalf("resend inside cooldown: got %d, want 429", status)
	}

	wrong := "000000"
	if wrong == code {
		wrong = "111111"
	}
	if status, _ := call("POST", "/api/v1/auth/verify-otp", "", map[string]string{"phone": phone, "code": wrong}); status != 401 {
		t.Fatalf("wrong code: got %d", status)
	}
	status, login := call("POST", "/api/v1/auth/verify-otp", "", map[string]string{"phone": "0" + phone[4:], "code": code})
	if status != 200 || login["access_token"] == nil {
		t.Fatalf("verify: %d %v", status, login)
	}
	if user, _ := login["user"].(map[string]any); user["phone_verified"] != true || user["email_verified"] != false {
		t.Fatalf("flags after phone login: %v", user)
	}
	// Single use.
	if status, _ := call("POST", "/api/v1/auth/verify-otp", "", map[string]string{"phone": phone, "code": code}); status != 401 {
		t.Fatalf("reused code: got %d", status)
	}
	token := login["access_token"].(string)

	// Email verification.
	if status, r := call("POST", "/api/v1/verification/send", token, map[string]string{"purpose": "verify_email"}); status != 200 {
		t.Fatalf("send email code: %d %v", status, r)
	}
	emailCode := nextCode()
	status, verified := call("POST", "/api/v1/verification/verify", token, map[string]string{"purpose": "verify_email", "code": emailCode})
	if user, _ := verified["user"].(map[string]any); status != 200 || user["email_verified"] != true {
		t.Fatalf("verify email: %d %v", status, verified)
	}

	// Five wrong guesses destroy a code: the right code then fails too.
	_, _ = env.pool.Exec(env.ctx, `DELETE FROM otp_send_events WHERE created_at > NOW() - INTERVAL '1 hour'`)
	other := "otp2-" + env.suffix + "@example.com"
	if status, r := call("POST", "/api/v1/verification/send", token, map[string]string{"purpose": "verify_email", "destination": other}); status != 200 {
		t.Fatalf("send second email code: %d %v", status, r)
	}
	secondCode := nextCode()
	badGuess := "000000"
	if badGuess == secondCode {
		badGuess = "999999"
	}
	for i := 0; i < otpAttemptLimit; i++ {
		call("POST", "/api/v1/verification/verify", token, map[string]string{"purpose": "verify_email", "destination": other, "code": badGuess})
	}
	if status, _ := call("POST", "/api/v1/verification/verify", token, map[string]string{"purpose": "verify_email", "destination": other, "code": secondCode}); status != 401 {
		t.Fatalf("code should be destroyed after %d wrong attempts, got %d", otpAttemptLimit, status)
	}
}
