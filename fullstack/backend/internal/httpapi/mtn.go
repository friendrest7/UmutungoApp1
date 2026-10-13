package httpapi

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/umutungo/umutungo/backend/internal/config"
)

type momoClient struct {
	cfg  config.Config
	http *http.Client
}

type momoRequestError struct {
	message   string
	ambiguous bool
}

func (e *momoRequestError) Error() string { return e.message }

var momoTokenMu sync.Mutex
var momoCachedToken string
var momoTokenExpires time.Time
var momoCachedTokenKey string

func newMoMoClient(cfg config.Config) momoClient {
	return momoClient{cfg: cfg, http: &http.Client{Timeout: 15 * time.Second}}
}

func (m momoClient) configured() bool {
	return m.cfg.MTNAPIUser != "" && m.cfg.MTNAPIKey != "" && m.cfg.MTNSubscriptionKey != "" && m.cfg.MTNBaseURL != ""
}

func (m momoClient) token(ctx context.Context) (string, error) {
	if !m.configured() {
		return "", fmt.Errorf("MTN MoMo collection credentials are not configured")
	}
	momoTokenMu.Lock()
	defer momoTokenMu.Unlock()
	tokenKey := m.cfg.MTNBaseURL + ":" + m.cfg.MTNAPIUser + ":" + m.cfg.MTNTargetEnvironment + ":" + m.cfg.MTNSubscriptionKey
	if momoCachedToken != "" && tokenKey == momoCachedTokenKey && time.Now().Before(momoTokenExpires) {
		return momoCachedToken, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, m.cfg.MTNBaseURL+"/collection/token/", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(m.cfg.MTNAPIUser+":"+m.cfg.MTNAPIKey)))
	req.Header.Set("Ocp-Apim-Subscription-Key", m.cfg.MTNSubscriptionKey)
	req.Header.Set("X-Target-Environment", m.cfg.MTNTargetEnvironment)
	resp, err := m.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("MTN token request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("MTN token request returned HTTP %d", resp.StatusCode)
	}
	var result struct {
		Token     string `json:"access_token"`
		ExpiresIn int    `json:"expires_in"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return "", fmt.Errorf("could not read MTN token response")
	}
	if result.Token == "" {
		return "", fmt.Errorf("MTN returned an empty access token")
	}
	duration := time.Duration(result.ExpiresIn) * time.Second
	if duration <= time.Minute {
		duration = 4 * time.Minute
	} else {
		duration -= time.Minute
	}
	momoCachedToken, momoTokenExpires, momoCachedTokenKey = result.Token, time.Now().Add(duration), tokenKey
	return result.Token, nil
}

func (m momoClient) requestToPay(ctx context.Context, ref, phone string, amount float64, currency string) error {
	token, err := m.token(ctx)
	if err != nil {
		return err
	}
	// Rwanda MSISDNs are sent in international form without a leading plus.
	msisdn := strings.TrimPrefix(strings.TrimSpace(phone), "+")
	if strings.HasPrefix(msisdn, "0") {
		msisdn = "25" + msisdn
	}
	if !strings.HasPrefix(msisdn, "250") || len(msisdn) != 12 {
		return fmt.Errorf("enter a valid Rwanda mobile number")
	}
	for _, digit := range msisdn {
		if digit < '0' || digit > '9' {
			return fmt.Errorf("enter a valid Rwanda mobile number")
		}
	}
	if math.Trunc(amount) != amount {
		return fmt.Errorf("MTN MoMo supports whole RWF amounts only")
	}
	body, _ := json.Marshal(map[string]any{
		"amount": fmt.Sprintf("%.0f", amount), "currency": currency, "externalId": ref,
		"payer":        map[string]string{"partyIdType": "MSISDN", "partyId": msisdn},
		"payerMessage": "Umutungo payment", "payeeNote": "Umutungo payment",
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, m.cfg.MTNBaseURL+"/collection/v1_0/requesttopay", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Ocp-Apim-Subscription-Key", m.cfg.MTNSubscriptionKey)
	req.Header.Set("X-Target-Environment", m.cfg.MTNTargetEnvironment)
	req.Header.Set("X-Reference-Id", ref)
	req.Header.Set("Content-Type", "application/json")
	resp, err := m.http.Do(req)
	if err != nil {
		return &momoRequestError{message: "MTN payment request outcome is unknown", ambiguous: true}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		return &momoRequestError{message: fmt.Sprintf("MTN payment request returned HTTP %d", resp.StatusCode), ambiguous: resp.StatusCode >= 500}
	}
	return nil
}

func (m momoClient) paymentStatus(ctx context.Context, ref string) (string, error) {
	token, err := m.token(ctx)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, m.cfg.MTNBaseURL+"/collection/v1_0/requesttopay/"+ref, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Ocp-Apim-Subscription-Key", m.cfg.MTNSubscriptionKey)
	req.Header.Set("X-Target-Environment", m.cfg.MTNTargetEnvironment)
	resp, err := m.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("MTN status request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return "failed", nil
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("MTN status request returned HTTP %d", resp.StatusCode)
	}
	var result struct {
		Status                 string `json:"status"`
		FinancialTransactionID string `json:"financialTransactionId"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return "", fmt.Errorf("could not read MTN status response")
	}
	switch strings.ToUpper(result.Status) {
	case "SUCCESSFUL":
		return "successful", nil
	case "FAILED":
		return "failed", nil
	default:
		return "pending", nil
	}
}
