package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/umutungo/umutungo/backend/internal/config"
)

func smsProviderConfigured(cfg config.Config) bool {
	return newMTNSMSClient(cfg).configured() || (cfg.TwilioAccountSID != "" && cfg.TwilioAuthToken != "" && cfg.TwilioFromNumber != "")
}

func sendVerificationSMS(ctx context.Context, cfg config.Config, phone, code string) error {
	if mtn := newMTNSMSClient(cfg); mtn.configured() {
		if err := mtn.sendVerificationCode(ctx, phone, code); err == nil {
			return nil
		} else if cfg.TwilioAccountSID == "" || cfg.TwilioAuthToken == "" || cfg.TwilioFromNumber == "" {
			return err
		}
	}
	if cfg.TwilioAccountSID == "" || cfg.TwilioAuthToken == "" || cfg.TwilioFromNumber == "" {
		return fmt.Errorf("no SMS provider is configured")
	}
	form := url.Values{}
	form.Set("To", phone)
	form.Set("From", cfg.TwilioFromNumber)
	form.Set("Body", fmt.Sprintf("Your Umutungo verification code is %s. It expires in 10 minutes. Do not share this code.", code))
	endpoint := "https://api.twilio.com/2010-04-01/Accounts/" + url.PathEscape(cfg.TwilioAccountSID) + "/Messages.json"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("could not create SMS request")
	}
	req.SetBasicAuth(cfg.TwilioAccountSID, cfg.TwilioAuthToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("SMS provider request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("SMS provider returned HTTP %d", resp.StatusCode)
	}
	return nil
}
