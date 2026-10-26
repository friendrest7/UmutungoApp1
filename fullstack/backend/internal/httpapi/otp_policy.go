package httpapi

import (
	"context"
	"errors"
	"time"
)

const (
	otpValidity       = 10 * time.Minute
	otpResendCooldown = time.Minute
	otpHourlyLimit    = 5
	otpAttemptLimit   = 5
)

var errOTPResendLimited = errors.New("verification code resend limit reached")

func otpResendWait(recentCount int, lastSentAt *time.Time, now time.Time) time.Duration {
	if recentCount >= otpHourlyLimit {
		return time.Hour
	}
	if lastSentAt == nil {
		return 0
	}
	remaining := otpResendCooldown - now.Sub(*lastSentAt)
	if remaining > 0 {
		return remaining
	}
	return 0
}

func otpAttemptAllowed(attempts int) bool { return attempts >= 0 && attempts < otpAttemptLimit }

func (s *Server) issueOTP(ctx context.Context, phone, code string) (string, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('umutungo_otp'),hashtext($1))`, phone); err != nil {
		return "", err
	}
	var recentCount int
	var lastSentAt *time.Time
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour'),MAX(created_at) FROM otp_challenges WHERE phone=$1`, phone).Scan(&recentCount, &lastSentAt); err != nil {
		return "", err
	}
	wait := otpResendWait(recentCount, lastSentAt, time.Now())
	if wait > 0 {
		return "", errOTPResendLimited
	}
	if _, err := tx.Exec(ctx, `UPDATE otp_challenges SET used_at=NOW() WHERE phone=$1 AND used_at IS NULL`, phone); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM otp_challenges WHERE phone=$1 AND created_at < NOW() - INTERVAL '1 day'`, phone); err != nil {
		return "", err
	}
	var id string
	if err := tx.QueryRow(ctx, `INSERT INTO otp_challenges(phone,code_hash,expires_at) VALUES($1,$2,NOW()+$3::interval) RETURNING id`, phone, hash(code), otpValidity.String()).Scan(&id); err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return id, nil
}

func (s *Server) invalidateOTP(ctx context.Context, id string) {
	if s.db == nil || id == "" {
		return
	}
	_, _ = s.db.Exec(ctx, `UPDATE otp_challenges SET used_at=NOW() WHERE id=$1 AND used_at IS NULL`, id)
}
