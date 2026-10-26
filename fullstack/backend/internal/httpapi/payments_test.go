package httpapi

import "testing"

func TestValidateMoMoPayment(t *testing.T) {
	valid := momoPaymentStatus{Status: "successful", ExternalID: "ref-123", Amount: "25000", Currency: "RWF", FinancialTransactionID: "mtn-456"}
	if err := validateMoMoPayment("ref-123", 25000, "RWF", valid); err != nil {
		t.Fatalf("valid payment rejected: %v", err)
	}
	cases := []struct {
		name   string
		change func(*momoPaymentStatus)
	}{
		{"reference mismatch", func(p *momoPaymentStatus) { p.ExternalID = "other" }},
		{"amount mismatch", func(p *momoPaymentStatus) { p.Amount = "25001" }},
		{"currency mismatch", func(p *momoPaymentStatus) { p.Currency = "USD" }},
		{"missing transaction id", func(p *momoPaymentStatus) { p.FinancialTransactionID = "" }},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			payment := valid
			test.change(&payment)
			if err := validateMoMoPayment("ref-123", 25000, "RWF", payment); err == nil {
				t.Fatal("invalid provider response was accepted")
			}
		})
	}
}

func TestPaymentTransitionIsIdempotent(t *testing.T) {
	if !shouldApplyPaymentTransition("pending", "successful") {
		t.Fatal("pending payment should accept a provider-confirmed success")
	}
	for _, status := range []string{"successful", "failed", "expired", "refunded"} {
		if shouldApplyPaymentTransition(status, "successful") {
			t.Errorf("%s payment must not apply success side effects a second time", status)
		}
	}
	for _, status := range []string{"pending", "unknown"} {
		if shouldApplyPaymentTransition("pending", status) {
			t.Errorf("non-final provider state %s must not be persisted as final", status)
		}
	}
}
