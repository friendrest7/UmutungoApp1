package httpapi

import "testing"

func TestCalculatePostingFeeUsesConfiguredRateAndFixedAmount(t *testing.T) {
	tests := []struct { name string; price, rate, fixed, want float64 }{
		{name:"percentage fee",price:10_000_000,rate:2.5,want:250_000},
		{name:"percentage plus fixed fee",price:10_000_000,rate:2.5,fixed:1250.5,want:251_250.5},
		{name:"round to cents",price:123.45,rate:1.25,want:1.54},
	}
	for _,test:=range tests { t.Run(test.name,func(t *testing.T) { if got:=calculatePostingFee(test.price,test.rate,test.fixed); got!=test.want { t.Fatalf("fee = %.2f; want %.2f",got,test.want) } }) }
}

func TestPostingRolePreservesLandlordIdentity(t *testing.T) {
	if got:=postingRole(CurrentUser{Role:"property_owner",WorkspaceKind:"landlord"}); got!="landlord" { t.Fatalf("posting role = %q",got) }
	if got:=postingRole(CurrentUser{Role:"property_owner",WorkspaceKind:"property_owner"}); got!="property_owner" { t.Fatalf("posting role = %q",got) }
	if got:=postingRole(CurrentUser{Role:"komisiyoneri"}); got!="komisiyoneri" { t.Fatalf("posting role = %q",got) }
}
