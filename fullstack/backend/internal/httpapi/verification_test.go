package httpapi

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/umutungo/umutungo/backend/internal/config"
)

func TestGenerateOTPCodeIsSixDigitsAndVaries(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		code, err := generateOTPCode()
		if err != nil {
			t.Fatal(err)
		}
		if !isSixDigits(code) {
			t.Fatalf("code %q is not six digits", code)
		}
		seen[code] = true
	}
	// 200 draws from a million values: duplicates are possible but rare.
	if len(seen) < 190 {
		t.Fatalf("only %d distinct codes in 200 draws; generator looks broken", len(seen))
	}
}

func TestOTPCodeHashIsKeyedAndBound(t *testing.T) {
	s := &Server{cfg: config.Config{OTPHMACSecret: "a-test-secret-that-is-at-least-32-chars"}}
	base := s.otpCodeHash(purposeLogin, "+250788123456", "user-1", "123456")
	if base != s.otpCodeHash(purposeLogin, "+250788123456", "user-1", "123456") {
		t.Fatal("hash must be deterministic")
	}
	variants := map[string]string{
		"different code":        s.otpCodeHash(purposeLogin, "+250788123456", "user-1", "123457"),
		"different destination": s.otpCodeHash(purposeLogin, "+250788123457", "user-1", "123456"),
		"different user":        s.otpCodeHash(purposeLogin, "+250788123456", "user-2", "123456"),
		"different purpose":     s.otpCodeHash(purposeChangePhone, "+250788123456", "user-1", "123456"),
	}
	for name, value := range variants {
		if value == base {
			t.Fatalf("%s produced the same hash", name)
		}
	}
	other := &Server{cfg: config.Config{OTPHMACSecret: "another-secret-that-is-at-least-32-chars"}}
	if other.otpCodeHash(purposeLogin, "+250788123456", "user-1", "123456") == base {
		t.Fatal("hash must depend on the secret")
	}
}

func TestOTPSendWait(t *testing.T) {
	now := time.Date(2026, 11, 12, 12, 0, 0, 0, time.UTC)
	at := func(d time.Duration) *time.Time { v := now.Add(-d); return &v }

	if w := otpSendWait(now, otpSendStats{}, otpSendStats{}); w != 0 {
		t.Fatalf("first send should be allowed, wait=%v", w)
	}
	if w := otpSendWait(now, otpSendStats{Count: 1, Oldest: at(20 * time.Second), Latest: at(20 * time.Second)}); w != 40*time.Second {
		t.Fatalf("60s cooldown: wait=%v, want 40s", w)
	}
	// Per-IP cooldown applies even when the destination is fresh.
	if w := otpSendWait(now, otpSendStats{}, otpSendStats{Count: 1, Oldest: at(30 * time.Second), Latest: at(30 * time.Second)}); w != 30*time.Second {
		t.Fatalf("IP cooldown: wait=%v, want 30s", w)
	}
	// 5 sends in the hour: wait until the oldest one is an hour old.
	full := otpSendStats{Count: otpHourlyLimit, Oldest: at(50 * time.Minute), Latest: at(5 * time.Minute)}
	if w := otpSendWait(now, full); w != 10*time.Minute {
		t.Fatalf("hourly limit: wait=%v, want 10m", w)
	}
	if w := otpSendWait(now, otpSendStats{Count: otpHourlyLimit - 1, Oldest: at(50 * time.Minute), Latest: at(5 * time.Minute)}); w != 0 {
		t.Fatalf("4 sends should still allow a 5th, wait=%v", w)
	}
}

func TestNormalizePhone(t *testing.T) {
	valid := map[string]string{
		"0788 123 456":     "+250788123456",
		"+250 788-123-456": "+250788123456",
		"250788123456":     "+250788123456",
		"00250788123456":   "+250788123456",
		"+1 202 555 0143":  "+12025550143",
		"+44 7911 123456":  "+447911123456",
		"+254 712 345678":  "+254712345678",
	}
	for input, want := range valid {
		got, err := normalizePhone(input)
		if err != nil || got != want {
			t.Errorf("normalizePhone(%q) = %q, %v; want %q", input, got, err, want)
		}
	}
	for _, input := range []string{"", "12345", "+250 12", "not a phone", "+999 123456789"} {
		if got, err := normalizePhone(input); err == nil {
			t.Errorf("normalizePhone(%q) = %q; want an error", input, got)
		}
	}
}

func TestNormalizeEmail(t *testing.T) {
	if got, err := normalizeEmail("  Alice@Example.COM "); err != nil || got != "alice@example.com" {
		t.Fatalf("got %q, %v", got, err)
	}
	for _, input := range []string{"", "alice", "alice@localhost", "Alice <alice@example.com>", "a@example.com\r\nBcc: x@evil.com"} {
		if got, err := normalizeEmail(input); err == nil {
			t.Errorf("normalizeEmail(%q) = %q; want an error", input, got)
		}
	}
}

func TestClientIP(t *testing.T) {
	r := httptest.NewRequest("POST", "/", nil)
	r.RemoteAddr = "10.0.0.5:4321"
	r.Header.Set("X-Forwarded-For", "6.6.6.6, 41.186.1.2, 76.76.21.9")

	if got := clientIP(r, 0); got != "10.0.0.5" {
		t.Fatalf("hops=0 must ignore X-Forwarded-For, got %s", got)
	}
	// Vercel + Render: the client is 2nd from the right. "6.6.6.6" was typed
	// by the client and must not be trusted.
	if got := clientIP(r, 2); got != "41.186.1.2" {
		t.Fatalf("hops=2 got %s, want 41.186.1.2", got)
	}
	if got := clientIP(r, 1); got != "76.76.21.9" {
		t.Fatalf("hops=1 got %s", got)
	}
}
