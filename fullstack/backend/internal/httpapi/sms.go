package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/umutungo/umutungo/backend/internal/config"
)

var smsHTTPClient = &http.Client{Timeout: 15 * time.Second}

func africasTalkingConfigured(cfg config.Config) bool {
	return cfg.AfricasTalkingUsername != "" && cfg.AfricasTalkingAPIKey != ""
}

func twilioConfigured(cfg config.Config) bool {
	return cfg.TwilioAccountSID != "" && cfg.TwilioAuthToken != "" && cfg.TwilioFromNumber != ""
}

// smsProviderConfigured reports whether at least one SMS provider has credentials.
func smsProviderConfigured(cfg config.Config) bool {
	return africasTalkingConfigured(cfg) || newMTNSMSClient(cfg).configured() || twilioConfigured(cfg)
}

func verificationSMSText(code string) string {
	return fmt.Sprintf("Your Umutungo verification code is %s. It expires in 10 minutes. Never share this code with anyone.", code)
}

// sendVerificationSMS tries each configured provider in order and stops at the
// first one that accepts the message:
//  1. Africa's Talking (works across Africa, and many other countries)
//  2. MTN SMS v3 (Rwanda numbers only)
//  3. Twilio (worldwide fallback)
func sendVerificationSMS(ctx context.Context, cfg config.Config, phone, code string) error {
	var failures []error
	if africasTalkingConfigured(cfg) {
		err := sendAfricasTalkingSMS(ctx, cfg, phone, verificationSMSText(code))
		if err == nil {
			return nil
		}
		failures = append(failures, fmt.Errorf("africa's talking: %w", err))
	}
	if mtn := newMTNSMSClient(cfg); mtn.configured() && strings.HasPrefix(phone, "+250") {
		err := mtn.sendVerificationCode(ctx, phone, code)
		if err == nil {
			return nil
		}
		failures = append(failures, fmt.Errorf("mtn: %w", err))
	}
	if twilioConfigured(cfg) {
		err := sendTwilioSMS(ctx, cfg, phone, verificationSMSText(code))
		if err == nil {
			return nil
		}
		failures = append(failures, fmt.Errorf("twilio: %w", err))
	}
	if len(failures) == 0 {
		return errors.New("no SMS provider is configured for this number")
	}
	return errors.Join(failures...)
}

// sendAfricasTalkingSMS calls the Africa's Talking messaging API.
// Docs: https://developers.africastalking.com/docs/sms/sending
// In sandbox mode messages only show up in their online simulator, not on real phones.
func sendAfricasTalkingSMS(ctx context.Context, cfg config.Config, phone, message string) error {
	endpoint := "https://api.africastalking.com/version1/messaging"
	if cfg.AfricasTalkingSandbox {
		endpoint = "https://api.sandbox.africastalking.com/version1/messaging"
	}
	form := url.Values{}
	form.Set("username", cfg.AfricasTalkingUsername)
	form.Set("to", phone)
	form.Set("message", message)
	if cfg.AfricasTalkingSenderID != "" {
		form.Set("from", cfg.AfricasTalkingSenderID)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("apiKey", cfg.AfricasTalkingAPIKey)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := smsHTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	// A 2xx response can still contain a per-recipient failure (for example
	// "InsufficientBalance" or "InvalidPhoneNumber"), so check the recipient status.
	var result struct {
		SMSMessageData struct {
			Recipients []struct {
				StatusCode int    `json:"statusCode"`
				Status     string `json:"status"`
			} `json:"Recipients"`
		} `json:"SMSMessageData"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("unreadable response")
	}
	recipients := result.SMSMessageData.Recipients
	if len(recipients) == 0 {
		return fmt.Errorf("message was not accepted for any recipient")
	}
	// 100 = processed, 101 = sent, 102 = queued. Anything else is a failure.
	if code := recipients[0].StatusCode; code < 100 || code > 102 {
		return fmt.Errorf("recipient status %q (%d)", recipients[0].Status, code)
	}
	return nil
}

func sendTwilioSMS(ctx context.Context, cfg config.Config, phone, message string) error {
	form := url.Values{}
	form.Set("To", phone)
	form.Set("From", cfg.TwilioFromNumber)
	form.Set("Body", message)
	endpoint := "https://api.twilio.com/2010-04-01/Accounts/" + url.PathEscape(cfg.TwilioAccountSID) + "/Messages.json"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.SetBasicAuth(cfg.TwilioAccountSID, cfg.TwilioAuthToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := smsHTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return nil
}
