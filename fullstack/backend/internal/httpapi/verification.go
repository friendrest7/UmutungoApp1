package httpapi

// One-time-code (OTP) verification for phone numbers and email addresses.
//
// The flow is always the same two steps:
//   1. send:   create a 6-digit code, store only its keyed hash, deliver it.
//   2. verify: compare the typed code against the hash; on a match, delete the
//              code and update the account in the same database transaction.
//
// Every code has a purpose, and the purpose decides the channel and who may ask:
//   login         SMS    anyone (only registered numbers actually get a code)
//   change_phone  SMS    signed-in users, for a new number
//   verify_email  email  signed-in users

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math"
	"math/big"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	otpValidity       = 10 * time.Minute
	otpResendCooldown = time.Minute // 1 send per 60 s ...
	otpHourlyLimit    = 5           // ... and at most 5 per hour, per destination AND per IP
	otpAttemptLimit   = 5           // wrong guesses before the code is destroyed
	otpMinSecretBytes = 32
)

type otpPurpose string

const (
	purposeLogin       otpPurpose = "login"
	purposeChangePhone otpPurpose = "change_phone"
	purposeVerifyEmail otpPurpose = "verify_email"
)

func parseOTPPurpose(value string) (otpPurpose, bool) {
	switch otpPurpose(strings.TrimSpace(value)) {
	case purposeLogin:
		return purposeLogin, true
	case purposeChangePhone:
		return purposeChangePhone, true
	case purposeVerifyEmail:
		return purposeVerifyEmail, true
	}
	return "", false
}

func (p otpPurpose) channel() string {
	if p == purposeVerifyEmail {
		return "email"
	}
	return "sms"
}

func (p otpPurpose) needsSignIn() bool { return p != purposeLogin }

var (
	errOTPInvalid       = errors.New("invalid or expired verification code")
	errOTPNotConfigured = errors.New("verification delivery is not configured")
	errPhoneUnavailable = errors.New("this phone number can't be used for your account")
	errEmailUnavailable = errors.New("this email address can't be used for your account")
)

type otpRateLimitError struct{ wait time.Duration }

func (e otpRateLimitError) Error() string { return "too many verification codes requested" }

// The same reply is sent whether or not the phone/email belongs to an account,
// so the reply can't be used to find out who is registered.
const otpCodeSentMessage = "If this can receive codes, a verification code is on its way. It expires in 10 minutes."

func otpCodeSentResponse() map[string]any {
	return map[string]any{
		"message":              otpCodeSentMessage,
		"expires_in_seconds":   int(otpValidity.Seconds()),
		"resend_after_seconds": int(otpResendCooldown.Seconds()),
	}
}

// ---------------------------------------------------------------------------
// Small pure functions (no database), covered by verification_test.go.

// generateOTPCode returns a uniformly random 6-digit code. crypto/rand is the
// operating system's secure generator; rand.Int avoids the bias that
// "randomByte % 10" would have (256 isn't a multiple of 10).
func generateOTPCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func isSixDigits(code string) bool {
	if len(code) != 6 {
		return false
	}
	for _, c := range code {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// otpMAC is a keyed hash (HMAC-SHA256). There are only a million possible
// codes, so a plain SHA-256 hash could be reversed in a fraction of a second by
// anyone holding a copy of the database. With HMAC they would also need
// OTP_HMAC_SECRET, which lives only in the server's environment.
// Parts are separated by a zero byte so ("ab","c") and ("a","bc") differ.
func otpMAC(secret string, parts ...string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	for _, part := range parts {
		mac.Write([]byte(part))
		mac.Write([]byte{0})
	}
	return hex.EncodeToString(mac.Sum(nil))
}

// The hash also covers purpose, destination and account, so a code can't be
// reused for a different purpose, number or account.
func (s *Server) otpCodeHash(purpose otpPurpose, destination, userID, code string) string {
	return otpMAC(s.cfg.OTPHMACSecret, "code", string(purpose), destination, userID, code)
}

func (s *Server) otpDestinationKey(channel, destination string) string {
	return otpMAC(s.cfg.OTPHMACSecret, "destination", channel, destination)
}

type otpSendStats struct {
	Count          int        // sends in the last hour
	Oldest, Latest *time.Time // first and last of those sends
}

// otpSendWait returns how long the caller must wait before another send, or 0.
func otpSendWait(now time.Time, stats ...otpSendStats) time.Duration {
	var wait time.Duration
	for _, st := range stats {
		if st.Latest != nil {
			if w := st.Latest.Add(otpResendCooldown).Sub(now); w > wait {
				wait = w
			}
		}
		if st.Count >= otpHourlyLimit && st.Oldest != nil {
			if w := st.Oldest.Add(time.Hour).Sub(now); w > wait {
				wait = w
			}
		}
	}
	return wait
}

// clientIP finds the caller's IP address for per-IP rate limiting.
//
// In production a request passes through proxies (Vercel, then Render) before
// reaching this server, so r.RemoteAddr is the last proxy's address, the same for
// every user. Each proxy appends the address it received the request from to
// X-Forwarded-For. With TRUSTED_PROXY_HOPS=N we take the Nth entry from the
// right: those entries were written by our own proxies. Entries further left
// were written by the client and could be faked.
func clientIP(r *http.Request, trustedHops int) string {
	remote := r.RemoteAddr
	if host, _, err := net.SplitHostPort(remote); err == nil {
		remote = host
	}
	if trustedHops <= 0 {
		return remote
	}
	var forwarded []string
	for _, header := range r.Header.Values("X-Forwarded-For") {
		for _, part := range strings.Split(header, ",") {
			if part = strings.TrimSpace(part); part != "" {
				forwarded = append(forwarded, part)
			}
		}
	}
	if len(forwarded) == 0 {
		return remote
	}
	index := len(forwarded) - trustedHops
	if index < 0 {
		index = 0
	}
	if ip := net.ParseIP(forwarded[index]); ip != nil {
		return ip.String()
	}
	return remote
}

// ---------------------------------------------------------------------------
// Database + delivery.

func (s *Server) otpReady(purpose otpPurpose) error {
	if len(s.cfg.OTPHMACSecret) < otpMinSecretBytes {
		log.Printf("verification: OTP_HMAC_SECRET is missing or shorter than %d characters", otpMinSecretBytes)
		return errOTPNotConfigured
	}
	if purpose.channel() == "email" && !emailProviderConfigured(s.cfg) {
		return errOTPNotConfigured
	}
	if purpose.channel() == "sms" && !smsProviderConfigured(s.cfg) {
		return errOTPNotConfigured
	}
	return nil
}

type otpSendRequest struct {
	Purpose     otpPurpose
	Destination string // already normalized phone (E.164) or email
	UserID      string // account the code is for; "" = count it but send nothing
	IP          string
}

// sendOTP applies the rate limits, stores a new code and delivers it.
//
// When UserID is empty (for example a login code for a number nobody has
// registered) it still records the request and applies the limits, then quietly
// skips the code. Callers reply the same way in both cases.
func (s *Server) sendOTP(ctx context.Context, req otpSendRequest) error {
	if err := s.otpReady(req.Purpose); err != nil {
		return err
	}
	channel := req.Purpose.channel()
	destinationKey := s.otpDestinationKey(channel, req.Destination)

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Lock this destination and this IP until the transaction ends, so two
	// requests arriving at the same moment can't both squeeze under the limit.
	// The destination is always locked before the IP, so two requests can never
	// each hold the lock the other needs (no deadlock).
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('umutungo_otp_destination'), hashtext($1))`, destinationKey); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('umutungo_otp_ip'), hashtext($1))`, req.IP); err != nil {
		return err
	}

	var now time.Time
	var byDestination, byIP otpSendStats
	err = tx.QueryRow(ctx, `
		SELECT NOW(),
			COUNT(*) FILTER (WHERE destination_hash=$1), MIN(created_at) FILTER (WHERE destination_hash=$1), MAX(created_at) FILTER (WHERE destination_hash=$1),
			COUNT(*) FILTER (WHERE ip=$2),               MIN(created_at) FILTER (WHERE ip=$2),               MAX(created_at) FILTER (WHERE ip=$2)
		FROM otp_send_events
		WHERE (destination_hash=$1 OR ip=$2) AND created_at > NOW() - INTERVAL '1 hour'`, destinationKey, req.IP).
		Scan(&now, &byDestination.Count, &byDestination.Oldest, &byDestination.Latest, &byIP.Count, &byIP.Oldest, &byIP.Latest)
	if err != nil {
		return err
	}
	if wait := otpSendWait(now, byDestination, byIP); wait > 0 {
		return otpRateLimitError{wait: wait}
	}
	if _, err := tx.Exec(ctx, `INSERT INTO otp_send_events(destination_hash, ip) VALUES($1, $2)`, destinationKey, req.IP); err != nil {
		return err
	}
	// Housekeeping: old send records and expired codes are no longer needed.
	if _, err := tx.Exec(ctx, `DELETE FROM otp_send_events WHERE created_at < NOW() - INTERVAL '1 day'`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM otp_challenges WHERE expires_at < NOW()`); err != nil {
		return err
	}
	if req.UserID == "" {
		return tx.Commit(ctx)
	}

	code, err := generateOTPCode()
	if err != nil {
		return err
	}
	// Only the newest code works: sending a new one cancels any earlier one.
	if _, err := tx.Exec(ctx, `DELETE FROM otp_challenges WHERE channel=$1 AND purpose=$2 AND destination=$3 AND user_id=$4`,
		channel, string(req.Purpose), req.Destination, req.UserID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO otp_challenges(channel, purpose, destination, user_id, code_hash, expires_at)
		VALUES($1, $2, $3, $4, $5, NOW() + make_interval(secs => $6))`,
		channel, string(req.Purpose), req.Destination, req.UserID,
		s.otpCodeHash(req.Purpose, req.Destination, req.UserID, code), otpValidity.Seconds()); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// Deliver in the background. If we waited for the SMS/email provider here,
	// registered numbers would answer noticeably slower than unregistered ones
	// (which send nothing), and that timing difference would leak who has an
	// account. A failed delivery is logged; the user can press "resend".
	deliver := s.otpDeliver
	if deliver == nil {
		deliver = s.deliverOTP
	}
	go deliver(channel, req.Destination, code)
	return nil
}

func (s *Server) deliverOTP(channel, destination, code string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	var err error
	if channel == "email" {
		err = sendVerificationEmail(ctx, s.cfg, destination, code)
	} else {
		err = sendVerificationSMS(ctx, s.cfg, destination, code)
	}
	if err != nil {
		// Never log the code or the destination.
		log.Printf("verification: %s delivery failed: %v", channel, err)
	}
}

type otpCheck struct {
	Purpose     otpPurpose
	Destination string
	Code        string
	UserID      string // "" for login, where the code itself identifies the account
}

// consumeOTP checks a code.
//   - Match: the code is deleted (single use) and onSuccess runs in the SAME
//     transaction, so "code used up" and "account updated" happen together or not
//     at all.
//   - No match: the failed attempt is counted, and the 5th wrong guess deletes
//     the code. Returns errOTPInvalid.
//
// Missing, expired and wrong codes all give the same error, so a caller learns
// nothing except "that didn't work".
func (s *Server) consumeOTP(ctx context.Context, check otpCheck, onSuccess func(tx pgx.Tx, userID string) error) error {
	if len(s.cfg.OTPHMACSecret) < otpMinSecretBytes {
		return errOTPNotConfigured
	}
	code := strings.TrimSpace(check.Code)
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var challengeID, storedHash, userID string
	var attempts int
	err = tx.QueryRow(ctx, `
		SELECT id, code_hash, user_id::text, attempts FROM otp_challenges
		WHERE channel=$1 AND purpose=$2 AND destination=$3 AND ($4::text = '' OR user_id::text = $4)
		  AND expires_at > NOW()
		ORDER BY created_at DESC LIMIT 1
		FOR UPDATE`, check.Purpose.channel(), string(check.Purpose), check.Destination, check.UserID).
		Scan(&challengeID, &storedHash, &userID, &attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return errOTPInvalid
	}
	if err != nil {
		return err
	}

	expected := s.otpCodeHash(check.Purpose, check.Destination, userID, code)
	// hmac.Equal takes the same time whether the first or last character differs,
	// so response timing doesn't reveal how close a guess was.
	if !isSixDigits(code) || !hmac.Equal([]byte(expected), []byte(storedHash)) {
		if attempts+1 >= otpAttemptLimit {
			_, err = tx.Exec(ctx, `DELETE FROM otp_challenges WHERE id=$1`, challengeID)
		} else {
			_, err = tx.Exec(ctx, `UPDATE otp_challenges SET attempts=attempts+1 WHERE id=$1`, challengeID)
		}
		if err == nil {
			err = tx.Commit(ctx)
		}
		if err != nil {
			return err
		}
		return errOTPInvalid
	}

	if _, err := tx.Exec(ctx, `DELETE FROM otp_challenges WHERE id=$1`, challengeID); err != nil {
		return err
	}
	if err := onSuccess(tx, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// HTTP handlers.

func writeOTPError(w http.ResponseWriter, err error) {
	var limited otpRateLimitError
	switch {
	case errors.As(err, &limited):
		seconds := int(math.Ceil(limited.wait.Seconds()))
		w.Header().Set("Retry-After", strconv.Itoa(seconds))
		writeJSON(w, http.StatusTooManyRequests, map[string]any{
			"error":               "Too many codes requested. Please wait before trying again.",
			"retry_after_seconds": seconds,
		})
	case errors.Is(err, errOTPNotConfigured):
		errorJSON(w, http.StatusServiceUnavailable, "Verification codes can't be sent right now. Please try again later.")
	case errors.Is(err, errOTPInvalid):
		errorJSON(w, http.StatusUnauthorized, "That code is wrong or has expired. Check it, or request a new code.")
	case errors.Is(err, errPhoneUnavailable):
		errorJSON(w, http.StatusConflict, errPhoneUnavailable.Error())
	case errors.Is(err, errEmailUnavailable):
		errorJSON(w, http.StatusConflict, errEmailUnavailable.Error())
	default:
		log.Printf("verification: %v", err)
		errorJSON(w, http.StatusInternalServerError, "Something went wrong. Please try again.")
	}
}

// emailVerifiedElsewhere reports whether an account other than userID has
// already verified this email address. Unverified copies don't count: whoever
// proves the address first owns it.
func (s *Server) emailVerifiedElsewhere(ctx context.Context, q rowQuerier, email, userID string) (bool, error) {
	var taken bool
	err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email)=LOWER($1) AND email_verified_at IS NOT NULL AND id::text<>$2)`, email, userID).Scan(&taken)
	return taken, err
}

// normalizeOTPDestination validates the phone/email for a purpose. For
// verify_email an empty destination means "the email already on my account".
func normalizeOTPDestination(purpose otpPurpose, raw string, user CurrentUser) (string, error) {
	if purpose.channel() == "email" {
		if strings.TrimSpace(raw) == "" {
			raw = user.Email
		}
		return normalizeEmail(raw)
	}
	return normalizePhone(raw)
}

// POST /api/v1/verification/send   {"purpose": "...", "destination": "..."}
// POST /api/v1/verification/resend (same body; the 60-second cooldown applies)
func (s *Server) verificationSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use POST")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8*1024)
	var input struct {
		Purpose     string `json:"purpose"`
		Destination string `json:"destination"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	purpose, ok := parseOTPPurpose(input.Purpose)
	if !ok {
		errorJSON(w, http.StatusBadRequest, "purpose must be login, change_phone or verify_email")
		return
	}
	s.startVerification(w, r, purpose, input.Destination)
}

// POST /api/v1/verification/verify   {"purpose": "...", "destination": "...", "code": "123456"}
func (s *Server) verificationVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use POST")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8*1024)
	var input struct {
		Purpose     string `json:"purpose"`
		Destination string `json:"destination"`
		Code        string `json:"code"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	purpose, ok := parseOTPPurpose(input.Purpose)
	if !ok {
		errorJSON(w, http.StatusBadRequest, "purpose must be login, change_phone or verify_email")
		return
	}
	s.finishVerification(w, r, purpose, input.Destination, input.Code)
}

func (s *Server) startVerification(w http.ResponseWriter, r *http.Request, purpose otpPurpose, rawDestination string) {
	var user CurrentUser
	if purpose.needsSignIn() {
		var ok bool
		if user, ok = s.authUser(r); !ok {
			errorJSON(w, http.StatusUnauthorized, "authentication required")
			return
		}
	}
	destination, err := normalizeOTPDestination(purpose, rawDestination, user)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	req := otpSendRequest{Purpose: purpose, Destination: destination, IP: clientIP(r, s.cfg.TrustedProxyHops)}

	switch purpose {
	case purposeLogin:
		// Only registered, active accounts actually get a code. The reply is
		// the same either way.
		var id string
		err := s.db.QueryRow(r.Context(), `SELECT id FROM users WHERE phone=$1 AND status='active'`, destination).Scan(&id)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			writeOTPError(w, err)
			return
		}
		req.UserID = id
	case purposeChangePhone:
		if destination == user.Phone {
			errorJSON(w, http.StatusBadRequest, "This is already your phone number.")
			return
		}
		// If another account already uses the number, send nothing but reply as
		// usual, so this can't be used to check who is registered.
		var taken bool
		if err := s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE phone=$1 AND id<>$2)`, destination, user.ID).Scan(&taken); err != nil {
			writeOTPError(w, err)
			return
		}
		if !taken {
			req.UserID = user.ID
		}
	case purposeVerifyEmail:
		if destination == strings.ToLower(user.Email) && user.EmailVerified {
			writeJSON(w, http.StatusOK, map[string]any{"message": "Your email address is already verified.", "already_verified": true})
			return
		}
		// If another account has already verified this address, send nothing
		// but reply as usual, so this can't be used to check who is registered.
		// finishVerification checks again, under a lock, before saving.
		taken, err := s.emailVerifiedElsewhere(r.Context(), s.db, destination, user.ID)
		if err != nil {
			writeOTPError(w, err)
			return
		}
		if !taken {
			req.UserID = user.ID
		}
	}

	if err := s.sendOTP(r.Context(), req); err != nil {
		writeOTPError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, otpCodeSentResponse())
}

func (s *Server) finishVerification(w http.ResponseWriter, r *http.Request, purpose otpPurpose, rawDestination, code string) {
	var user CurrentUser
	if purpose.needsSignIn() {
		var ok bool
		if user, ok = s.authUser(r); !ok {
			errorJSON(w, http.StatusUnauthorized, "authentication required")
			return
		}
	}
	destination, err := normalizeOTPDestination(purpose, rawDestination, user)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(code) == "" {
		errorJSON(w, http.StatusBadRequest, "Enter the 6-digit code.")
		return
	}

	var accountID string
	err = s.consumeOTP(r.Context(), otpCheck{Purpose: purpose, Destination: destination, Code: code, UserID: user.ID},
		func(tx pgx.Tx, userID string) error {
			accountID = userID
			var tag pgconn.CommandTag
			var err error
			switch purpose {
			case purposeLogin:
				tag, err = tx.Exec(r.Context(), `
					UPDATE users SET verified_at=COALESCE(verified_at,NOW()), phone_verified_at=COALESCE(phone_verified_at,NOW()), updated_at=NOW()
					WHERE id=$1 AND phone=$2 AND status='active'`, userID, destination)
			case purposeChangePhone:
				tag, err = tx.Exec(r.Context(), `
					UPDATE users SET phone=$1, verified_at=COALESCE(verified_at,NOW()), phone_verified_at=NOW(), updated_at=NOW()
					WHERE id=$2`, destination, userID)
				var pgErr *pgconn.PgError
				if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation: number taken in the meantime
					return errPhoneUnavailable
				}
			case purposeVerifyEmail:
				// Only one account may hold a verified copy of an address. The
				// lock makes two accounts verifying the same address at the same
				// moment take turns, so the second one sees the first one's row.
				if _, err := tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(hashtext('umutungo_verified_email'), hashtext($1))`, destination); err != nil {
					return err
				}
				taken, checkErr := s.emailVerifiedElsewhere(r.Context(), tx, destination, userID)
				if checkErr != nil {
					return checkErr
				}
				if taken {
					return errEmailUnavailable
				}
				// The new address replaces the old one only now, after the code
				// sent to it was entered. Until then the old address and its
				// verified status stay as they were.
				tag, err = tx.Exec(r.Context(), `
					UPDATE users SET email=$1, email_verified_at=NOW(), updated_at=NOW() WHERE id=$2`, destination, userID)
			}
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 0 { // account suspended or changed since the code was sent
				return errOTPInvalid
			}
			return nil
		})
	if err != nil {
		writeOTPError(w, err)
		return
	}

	updated, ok := s.userByID(r, accountID)
	if !ok {
		errorJSON(w, http.StatusInternalServerError, "could not load your account")
		return
	}
	switch purpose {
	case purposeLogin:
		token, err := s.createSession(r, accountID)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not create session")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"user": updated, "access_token": token})
	case purposeChangePhone:
		writeJSON(w, http.StatusOK, map[string]any{"user": updated, "message": "Phone number verified and updated."})
	case purposeVerifyEmail:
		writeJSON(w, http.StatusOK, map[string]any{"user": updated, "message": "Email address verified."})
	}
}

// ---------------------------------------------------------------------------
// The older endpoints keep their URLs so existing app versions keep working.
// They now go through the same code as /api/v1/verification/*.

// POST /api/v1/auth/request-otp  {"phone": "..."}
func (s *Server) requestOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var input struct {
		Phone string `json:"phone"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	s.startVerification(w, r, purposeLogin, input.Phone)
}

// POST /api/v1/auth/verify-otp  {"phone": "...", "code": "..."}
func (s *Server) verifyOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var input struct {
		Phone string `json:"phone"`
		Code  string `json:"code"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	s.finishVerification(w, r, purposeLogin, input.Phone, input.Code)
}

// POST /api/v1/me/phone {"phone"} sends a code; PUT {"phone","code"} confirms it.
func (s *Server) mePhone(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Phone string `json:"phone"`
		Code  string `json:"code"`
	}
	switch r.Method {
	case http.MethodPost:
		if decodeJSON(w, r, &input) {
			s.startVerification(w, r, purposeChangePhone, input.Phone)
		}
	case http.MethodPut:
		if decodeJSON(w, r, &input) {
			s.finishVerification(w, r, purposeChangePhone, input.Phone, input.Code)
		}
	default:
		w.Header().Set("Allow", "POST, PUT")
		errorJSON(w, http.StatusMethodNotAllowed, "use POST to request a code or PUT to verify it")
	}
}
