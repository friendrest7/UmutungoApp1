package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/umutungo/umutungo/backend/internal/config"
)

type mtnSMSClient struct {
	cfg  config.Config
	http *http.Client
}

var (
	mtnSMSTokenMu      sync.Mutex
	mtnSMSToken        string
	mtnSMSTokenExpires time.Time
	mtnSMSTokenKey     string
)

func newMTNSMSClient(cfg config.Config) mtnSMSClient {
	return mtnSMSClient{cfg: cfg, http: &http.Client{Timeout: 15 * time.Second}}
}

func (m mtnSMSClient) configured() bool {
	return m.cfg.MTNSMSClientID != "" && m.cfg.MTNSMSClientSecret != "" && m.cfg.MTNSMSServiceCode != "" && m.cfg.MTNSMSBaseURL != "" && m.cfg.MTNSMSTokenURL != ""
}

func (m mtnSMSClient) accessToken(ctx context.Context) (string, error) {
	if !m.configured() {
		return "", fmt.Errorf("MTN SMS is not configured; add the SMS product credentials and approved service code")
	}
	mtnSMSTokenMu.Lock()
	defer mtnSMSTokenMu.Unlock()
	key := m.cfg.MTNSMSClientID + ":" + m.cfg.MTNSMSTokenURL
	if mtnSMSToken != "" && key == mtnSMSTokenKey && time.Now().Before(mtnSMSTokenExpires) {
		return mtnSMSToken, nil
	}
	form := url.Values{}
	form.Set("client_id", m.cfg.MTNSMSClientID)
	form.Set("client_secret", m.cfg.MTNSMSClientSecret)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, m.cfg.MTNSMSTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("could not create MTN SMS token request")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := m.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("MTN SMS token request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("MTN SMS token request returned HTTP %d", resp.StatusCode)
	}
	var result struct {
		Token     string          `json:"access_token"`
		ExpiresIn json.RawMessage `json:"expires_in"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil || result.Token == "" {
		return "", fmt.Errorf("MTN SMS returned an invalid access token response")
	}
	seconds, _ := strconv.Atoi(strings.Trim(string(result.ExpiresIn), `"`))
	if seconds <= 60 {
		seconds = 300
	} else {
		seconds -= 60
	}
	mtnSMSToken, mtnSMSTokenExpires, mtnSMSTokenKey = result.Token, time.Now().Add(time.Duration(seconds)*time.Second), key
	return result.Token, nil
}

func (m mtnSMSClient) sendVerificationCode(ctx context.Context, phone, code string) error {
	if !m.configured() {
		return fmt.Errorf("MTN SMS is not configured; add the SMS product credentials and approved service code")
	}
	msisdn, err := normalizeRwandaPhone(phone)
	if err != nil {
		return err
	}
	token, err := m.accessToken(ctx)
	if err != nil {
		return err
	}
	body := map[string]any{
		"receiverAddress":    []string{msisdn},
		"message":            fmt.Sprintf("Your Umutungo verification code is %s. It expires in 10 minutes. Do not share this code.", code),
		"serviceCode":        m.cfg.MTNSMSServiceCode,
		"clientCorrelatorId": fmt.Sprintf("umutungo-%d", time.Now().UnixNano()),
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("could not create MTN SMS request")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, m.cfg.MTNSMSBaseURL+"/messages/sms/outbound", strings.NewReader(string(encoded)))
	if err != nil {
		return fmt.Errorf("could not create MTN SMS request")
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := m.http.Do(req)
	if err != nil {
		return fmt.Errorf("MTN SMS send request failed: %w", err)
	}
	defer resp.Body.Close()
	var result struct {
		StatusCode    string `json:"statusCode"`
		StatusMessage string `json:"statusMessage"`
		Data          struct {
			Status string `json:"status"`
		} `json:"data"`
	}
	_ = json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result)
	if resp.StatusCode != http.StatusOK {
		if result.StatusMessage != "" {
			return fmt.Errorf("MTN SMS rejected the message: %s", result.StatusMessage)
		}
		return fmt.Errorf("MTN SMS send request returned HTTP %d", resp.StatusCode)
	}
	if result.StatusCode != "" && result.StatusCode != "0000" {
		return fmt.Errorf("MTN SMS rejected the message: %s", firstNonEmpty(result.StatusMessage, "provider error"))
	}
	return nil
}

func normalizeRwandaPhone(phone string) (string, error) {
	value := strings.NewReplacer(" ", "", "-", "", "(", "", ")", "").Replace(strings.TrimSpace(phone))
	if strings.HasPrefix(value, "00") {
		value = "+" + strings.TrimPrefix(value, "00")
	}
	if strings.HasPrefix(value, "0") {
		value = "+250" + strings.TrimPrefix(value, "0")
	} else if strings.HasPrefix(value, "250") {
		value = "+" + value
	}
	if len(value) != 13 || !strings.HasPrefix(value, "+2507") {
		return "", fmt.Errorf("enter a valid Rwanda mobile number")
	}
	for _, digit := range strings.TrimPrefix(value, "+") {
		if digit < '0' || digit > '9' {
			return "", fmt.Errorf("enter a valid Rwanda mobile number")
		}
	}
	return value, nil
}
