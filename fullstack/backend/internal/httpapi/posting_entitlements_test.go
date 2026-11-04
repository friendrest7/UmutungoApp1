package httpapi

import "testing"

func TestCalculatePostingFeeUsesConfiguredRateAndFixedAmount(t *testing.T) {
	tests := []struct {
		name                     string
		price, rate, fixed, want float64
	}{
		{name: "percentage fee", price: 10_000_000, rate: 2.5, want: 250_000},
		{name: "percentage plus fixed fee", price: 10_000_000, rate: 2.5, fixed: 1250.5, want: 251_250.5},
		{name: "round to cents", price: 123.45, rate: 1.25, want: 1.54},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := calculatePostingFee(test.price, test.rate, test.fixed); got != test.want {
				t.Fatalf("fee = %.2f; want %.2f", got, test.want)
			}
		})
	}
}

func TestPostingFeeByAccountModel(t *testing.T) {
	ownerRate, ownerFee, err := calculateRolePostingFee("property_owner", 1_250_000, 3, 0)
	if err != nil || ownerRate != 3 || ownerFee != 37_500 {
		t.Fatalf("property owner fee = rate %.2f amount %.2f err %v", ownerRate, ownerFee, err)
	}
	landlordRate, landlordFee, err := calculateRolePostingFee("landlord", 1_250_000, 3, 5_000)
	if err != nil || landlordRate != 0 || landlordFee != 5_000 {
		t.Fatalf("landlord fee = rate %.2f amount %.2f err %v; want configured flat fee", landlordRate, landlordFee, err)
	}
	if _, _, err := calculateRolePostingFee("komisiyoneri", 1_250_000, 3, 5_000); err == nil {
		t.Fatal("Komisiyoneri should use a purchased slot, not a per-listing fee")
	}
}

func TestPostingRolePreservesLandlordIdentity(t *testing.T) {
	if got := postingRole(CurrentUser{Role: "property_owner", WorkspaceKind: "landlord"}); got != "landlord" {
		t.Fatalf("posting role = %q", got)
	}
	if got := postingRole(CurrentUser{Role: "property_owner", WorkspaceKind: "property_owner"}); got != "property_owner" {
		t.Fatalf("posting role = %q", got)
	}
	if got := postingRole(CurrentUser{Role: "komisiyoneri"}); got != "komisiyoneri" {
		t.Fatalf("posting role = %q", got)
	}
}
