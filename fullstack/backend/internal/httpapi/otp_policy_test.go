package httpapi

import (
	"testing"
	"time"
)

func TestOTPPolicyLimits(t *testing.T) {
	now := time.Date(2026, time.October, 26, 12, 0, 0, 0, time.UTC)
	last := now.Add(-30 * time.Second)
	if got := otpResendWait(1, &last, now); got != 30*time.Second {
		t.Fatalf("cooldown remaining = %v, want 30s", got)
	}
	if got := otpResendWait(otpHourlyLimit, nil, now); got != time.Hour {
		t.Fatalf("hourly limit wait = %v, want 1h", got)
	}
	if otpResendWait(1, nil, now) != 0 {
		t.Fatal("first OTP request should not be delayed")
	}
	for attempts := 0; attempts <= otpAttemptLimit; attempts++ {
		if otpAttemptAllowed(attempts) != (attempts < otpAttemptLimit) {
			t.Fatalf("attempt allowance incorrect at %d", attempts)
		}
	}
}
