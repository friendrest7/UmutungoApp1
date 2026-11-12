package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/umutungo/umutungo/backend/internal/config"
)

func TestResolveMTNCurrencyEURSandboxOnly(t *testing.T) {
	cases := []struct{ raw, target, want string }{
		{"", "sandbox", "RWF"},
		{"EUR", "sandbox", "EUR"},
		{" eur ", "Sandbox", "EUR"},
		{"EUR", "mtnrwanda", "RWF"}, // production can never send EUR
		{"USD", "sandbox", "RWF"},
		{"RWF", "mtnrwanda", "RWF"},
	}
	for _, c := range cases {
		if got := config.ResolveMTNCurrency(c.raw, c.target); got != c.want {
			t.Errorf("ResolveMTNCurrency(%q, %q) = %q; want %q", c.raw, c.target, got, c.want)
		}
	}
}

// fakeMTN answers the token and request-to-pay calls in-process and records
// the currency MTN would have received. Nothing leaves the machine.
type fakeMTN struct{ currency string }

func (f *fakeMTN) RoundTrip(req *http.Request) (*http.Response, error) {
	reply := func(code int, body string) (*http.Response, error) {
		return &http.Response{StatusCode: code, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}, Request: req}, nil
	}
	switch {
	case strings.HasSuffix(req.URL.Path, "/collection/token/"):
		return reply(http.StatusOK, `{"access_token":"test-token","expires_in":3600}`)
	case strings.HasSuffix(req.URL.Path, "/collection/v1_0/requesttopay"):
		var body struct{ Currency string }
		_ = json.NewDecoder(req.Body).Decode(&body)
		f.currency = body.Currency
		return reply(http.StatusAccepted, ``)
	}
	return nil, errors.New("unexpected request " + req.URL.Path)
}

func TestRequestToPaySendsEUROnlyToSandbox(t *testing.T) {
	cases := []struct {
		name, target, baseURL, currencyEnv, want string
	}{
		{"sandbox with EUR", "sandbox", "https://sandbox.momodeveloper.mtn.com", "EUR", "EUR"},
		{"sandbox without EUR", "sandbox", "https://sandbox.momodeveloper.mtn.com", "", "RWF"},
		// Even if MTNCurrency were somehow EUR in production, RWF is sent.
		{"production", "mtnrwanda", "https://momoapi.mtn.com", "EUR", "RWF"},
	}
	for i, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			fake := &fakeMTN{}
			cfg := config.Config{
				MTNTargetEnvironment: c.target, MTNBaseURL: c.baseURL, MTNCurrency: c.currencyEnv,
				// Distinct credentials per case so the shared token cache doesn't carry over.
				MTNAPIUser: "user-" + c.name, MTNAPIKey: "key", MTNSubscriptionKey: "sub-" + string(rune('a'+i)),
			}
			client := momoClient{cfg: cfg, http: &http.Client{Transport: fake}}
			if err := client.requestToPay(context.Background(), "ref-1", "250788123456", 1000, "RWF"); err != nil {
				t.Fatal(err)
			}
			if fake.currency != c.want {
				t.Fatalf("MTN received currency %q; want %q", fake.currency, c.want)
			}
		})
	}
}

func TestMoMoStatusValidationUsesSandboxCurrency(t *testing.T) {
	client := momoClient{cfg: config.Config{MTNTargetEnvironment: "sandbox", MTNCurrency: "EUR"}}
	result := momoPaymentStatus{Status: "successful", ExternalID: "ref-1", Amount: "1000", Currency: "EUR", FinancialTransactionID: "tx-1"}
	currency := "RWF"
	if strings.EqualFold(currency, "RWF") {
		currency = client.providerCurrency()
	}
	if err := validateMoMoPayment("ref-1", 1000, currency, result); err != nil {
		t.Fatalf("sandbox EUR status rejected: %v", err)
	}
	// In production a EUR answer is still a mismatch.
	prod := momoClient{cfg: config.Config{MTNTargetEnvironment: "mtnrwanda", MTNCurrency: "EUR"}}
	if err := validateMoMoPayment("ref-1", 1000, prod.providerCurrency(), result); err == nil {
		t.Fatal("production accepted a EUR payment")
	}
}
