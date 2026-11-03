package httpapi

import (
	"errors"
	"log"
	"net/http"
	"strings"
)

func (s *Server) mePhone(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	switch r.Method {
	case http.MethodPost:
		s.requestPhoneUpdateOTP(w, r, user)
	case http.MethodPut:
		s.verifyPhoneUpdateOTP(w, r, user)
	default:
		w.Header().Set("Allow", "POST, PUT")
		errorJSON(w, http.StatusMethodNotAllowed, "use POST to request a code or PUT to verify it")
	}
}

func (s *Server) requestPhoneUpdateOTP(w http.ResponseWriter, r *http.Request, user CurrentUser) {
	r.Body = http.MaxBytesReader(w, r.Body, 8*1024)
	var input struct {
		Phone string `json:"phone"`
	}
	if !decodeJSON(w, r, &input) || strings.TrimSpace(input.Phone) == "" {
		errorJSON(w, http.StatusBadRequest, "phone is required")
		return
	}
	phone, err := normalizeRwandaPhone(input.Phone)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	if phone == user.Phone {
		errorJSON(w, http.StatusBadRequest, "enter a different phone number")
		return
	}
	var inUse bool
	if err := s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE phone=$1 AND id<>$2)`, phone, user.ID).Scan(&inUse); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not check phone number")
		return
	}
	if inUse {
		errorJSON(w, http.StatusConflict, "a user with this phone number already exists")
		return
	}
	if s.cfg.AppEnv != "development" && !smsProviderConfigured(s.cfg) {
		errorJSON(w, http.StatusServiceUnavailable, "SMS verification is not configured. Set MTN SMS or Twilio credentials.")
		return
	}
	code := ""
	if s.cfg.AppEnv == "development" {
		code = "111111"
	} else {
		code, err = randomDigits(6)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not create verification code")
			return
		}
	}
	otpID, err := s.issueOTP(r.Context(), phone, code)
	if err != nil {
		if errors.Is(err, errOTPResendLimited) {
			errorJSON(w, http.StatusTooManyRequests, "request another verification code after the resend limit resets")
			return
		}
		errorJSON(w, http.StatusInternalServerError, "could not create OTP challenge")
		return
	}
	smsConfigured := smsProviderConfigured(s.cfg)
	if s.cfg.AppEnv != "development" || smsConfigured {
		if err := sendVerificationSMS(r.Context(), s.cfg, phone, code); err != nil {
			log.Printf("phone update verification message delivery failed")
			s.invalidateOTP(r.Context(), otpID)
			errorJSON(w, http.StatusBadGateway, "could not deliver the verification code; try again later")
			return
		}
	}
	response := map[string]any{"message": "Verification code sent."}
	if s.cfg.AppEnv == "development" && !smsConfigured {
		response["message"] = "Use the development verification code."
		response["development_code"] = code
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Server) verifyPhoneUpdateOTP(w http.ResponseWriter, r *http.Request, user CurrentUser) {
	r.Body = http.MaxBytesReader(w, r.Body, 8*1024)
	var input struct {
		Phone string `json:"phone"`
		Code  string `json:"code"`
	}
	if !decodeJSON(w, r, &input) || strings.TrimSpace(input.Phone) == "" || strings.TrimSpace(input.Code) == "" {
		errorJSON(w, http.StatusBadRequest, "phone and verification code are required")
		return
	}
	phone, err := normalizeRwandaPhone(input.Phone)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not verify phone number")
		return
	}
	defer tx.Rollback(r.Context())
	var challengeID, codeHash string
	var attempts int
	err = tx.QueryRow(r.Context(), `
		SELECT id,code_hash,attempts FROM otp_challenges
		WHERE phone=$1 AND used_at IS NULL AND expires_at>NOW() AND attempts<$2
		ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, phone, otpAttemptLimit).Scan(&challengeID, &codeHash, &attempts)
	if err != nil {
		errorJSON(w, http.StatusUnauthorized, "invalid or expired verification code")
		return
	}
	if hash(strings.TrimSpace(input.Code)) != codeHash {
		_, updateErr := tx.Exec(r.Context(), `UPDATE otp_challenges SET attempts=attempts+1,used_at=CASE WHEN attempts+1>=$2 THEN NOW() ELSE used_at END WHERE id=$1`, challengeID, otpAttemptLimit)
		if updateErr == nil {
			updateErr = tx.Commit(r.Context())
		}
		if updateErr != nil {
			errorJSON(w, http.StatusInternalServerError, "could not verify phone number")
			return
		}
		errorJSON(w, http.StatusUnauthorized, "invalid or expired verification code")
		return
	}
	if _, err := tx.Exec(r.Context(), `UPDATE users SET phone=$1,verified_at=NOW(),updated_at=NOW() WHERE id=$2`, phone, user.ID); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			errorJSON(w, http.StatusConflict, "a user with this phone number already exists")
			return
		}
		errorJSON(w, http.StatusInternalServerError, "could not update phone number")
		return
	}
	if _, err := tx.Exec(r.Context(), `UPDATE otp_challenges SET used_at=NOW() WHERE id=$1 AND used_at IS NULL`, challengeID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not finish phone verification")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not finish phone verification")
		return
	}
	updatedUser, ok := s.userByID(r, user.ID)
	if !ok {
		errorJSON(w, http.StatusInternalServerError, "could not load updated account")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": updatedUser, "message": "Phone number verified and updated."})
}
