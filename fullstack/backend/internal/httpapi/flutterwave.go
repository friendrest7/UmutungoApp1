package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const flutterwaveAPI = "https://api.flutterwave.com/v3"

type flutterwaveClient struct {
	secret string
	http   *http.Client
}

type flutterwaveVerification struct {
	ID       int64   `json:"id"`
	TxRef    string  `json:"tx_ref"`
	Status   string  `json:"status"`
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
}

func newFlutterwaveClient(secret string) flutterwaveClient {
	return flutterwaveClient{secret: strings.TrimSpace(secret), http: &http.Client{Timeout: 20 * time.Second}}
}

func (f flutterwaveClient) startCheckout(ctx context.Context, txRef, email, name, redirectURL, method string, amount float64, listingID string) (string, error) {
	if f.secret == "" {
		return "", fmt.Errorf("Flutterwave is not configured. Set FLUTTERWAVE_SECRET_KEY on the backend")
	}
	if method != "card" && method != "mobilemoneyrwanda" {
		return "", fmt.Errorf("choose card or Rwanda mobile money")
	}
	body, err := json.Marshal(map[string]any{
		"tx_ref": txRef, "amount": amount, "currency": "RWF", "redirect_url": redirectURL,
		"payment_options": method,
		"customer":        map[string]string{"email": email, "name": name},
		"customizations":  map[string]string{"title": "Umutungo property upload", "description": "One-time property listing upload fee"},
		"meta":            map[string]string{"listing_id": listingID, "payment_type": "listing_upload"},
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, flutterwaveAPI+"/payments", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+f.secret)
	req.Header.Set("Content-Type", "application/json")
	resp, err := f.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("could not connect to Flutterwave: %w", err)
	}
	defer resp.Body.Close()
	var result struct {
		Status  string `json:"status"`
		Message string `json:"message"`
		Data    struct {
			Link string `json:"link"`
		} `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return "", fmt.Errorf("could not read Flutterwave checkout response")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 || result.Status != "success" || result.Data.Link == "" {
		if result.Message == "" {
			result.Message = "Flutterwave could not create checkout"
		}
		return "", fmt.Errorf("%s", result.Message)
	}
	return result.Data.Link, nil
}

func (f flutterwaveClient) verify(ctx context.Context, transactionID string) (flutterwaveVerification, error) {
	if f.secret == "" {
		return flutterwaveVerification{}, fmt.Errorf("Flutterwave is not configured")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, flutterwaveAPI+"/transactions/"+transactionID+"/verify", nil)
	if err != nil {
		return flutterwaveVerification{}, err
	}
	req.Header.Set("Authorization", "Bearer "+f.secret)
	resp, err := f.http.Do(req)
	if err != nil {
		return flutterwaveVerification{}, fmt.Errorf("could not verify Flutterwave payment: %w", err)
	}
	defer resp.Body.Close()
	var result struct {
		Status string                  `json:"status"`
		Data   flutterwaveVerification `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return flutterwaveVerification{}, fmt.Errorf("could not read Flutterwave verification response")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 || result.Status != "success" {
		return flutterwaveVerification{}, fmt.Errorf("Flutterwave could not verify this payment")
	}
	return result.Data, nil
}
