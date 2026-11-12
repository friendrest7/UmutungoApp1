package httpapi

import (
	"testing"
	"time"
)

func intPtr(v int) *int { return &v }

func TestPlanAllowanceRemaining(t *testing.T) {
	tests := []struct {
		name          string
		terms         *PlanTerms
		active        int
		wantRemaining int
		wantUnlimited bool
	}{
		{"no plan", nil, 0, 0, false},
		{"silver with room", &PlanTerms{ListingLimit: intPtr(30), FairUseListingCap: 500}, 12, 18, false},
		{"silver full", &PlanTerms{ListingLimit: intPtr(30), FairUseListingCap: 500}, 30, 0, false},
		{"over limit after downgrade never negative", &PlanTerms{ListingLimit: intPtr(30), FairUseListingCap: 500}, 45, 0, false},
		{"unlimited uses fair-use cap", &PlanTerms{ListingLimit: nil, FairUseListingCap: 500}, 120, 380, true},
		{"fair-use cap below limit wins", &PlanTerms{ListingLimit: intPtr(1000), FairUseListingCap: 200}, 150, 50, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			remaining, unlimited := planAllowanceRemaining(test.terms, test.active)
			if remaining != test.wantRemaining || unlimited != test.wantUnlimited {
				t.Fatalf("got remaining=%d unlimited=%v; want %d %v", remaining, unlimited, test.wantRemaining, test.wantUnlimited)
			}
		})
	}
}

func TestChoosePublishEntitlementOrder(t *testing.T) {
	plan := Entitlements{Source: sourceSubscription, AllowanceRemaining: 3, AvailableCredits: 2}
	tests := []struct {
		name string
		paid bool
		ent  Entitlements
		want string
		err  bool
	}{
		{"individually paid listing never consumes plan or credits", true, plan, publishViaListingPayment, false},
		{"plan used before prepaid credits", false, plan, publishViaPlan, false},
		{"credits used when plan is full", false, Entitlements{Source: sourceSubscription, AllowanceRemaining: 0, AvailableCredits: 2}, publishViaCredit, false},
		{"legacy owner upgrade grants no listing allowance", false, Entitlements{Source: sourceLegacyUpgrade, AllowanceRemaining: 5}, "", true},
		{"nothing available requires payment", false, Entitlements{Source: sourceNone}, "", true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := choosePublishEntitlement(test.paid, test.ent)
			if (err != nil) != test.err || got != test.want {
				t.Fatalf("got %q err=%v; want %q err=%v", got, err, test.want, test.err)
			}
		})
	}
}

func TestCoveredByPlanPreventsDoubleCharge(t *testing.T) {
	if !coveredByPlan(Entitlements{Source: sourceSubscription, AllowanceRemaining: 1}) {
		t.Fatal("a plan with allowance must cover the next listing")
	}
	if coveredByPlan(Entitlements{Source: sourceSubscription, AllowanceRemaining: 0}) {
		t.Fatal("a full plan must not block a per-listing payment")
	}
	if coveredByPlan(Entitlements{Source: sourceLegacyUpgrade, AllowanceRemaining: 9}) {
		t.Fatal("legacy upgrades do not include listings")
	}
}

func TestPlanChangePolicy(t *testing.T) {
	now := time.Date(2026, 11, 11, 10, 0, 0, 0, time.UTC)
	currentEnd := now.Add(10 * 24 * time.Hour)
	tests := []struct {
		current, next, wantKind string
		wantStart               time.Time
	}{
		{"free", "silver", "new", now},
		{"silver", "gold", "upgrade", now},
		{"gold", "gold", "renewal", currentEnd},
		{"platinum", "silver", "downgrade", currentEnd},
	}
	for _, test := range tests {
		kind := classifyPlanChange(test.current, test.next)
		if kind != test.wantKind {
			t.Fatalf("%s->%s kind = %s; want %s", test.current, test.next, kind, test.wantKind)
		}
		start, end := subscriptionPeriod(now, kind, &currentEnd, 30)
		if !start.Equal(test.wantStart) || !end.Equal(test.wantStart.Add(30*24*time.Hour)) {
			t.Fatalf("%s: period %s-%s; want start %s", kind, start, end, test.wantStart)
		}
	}
	// A renewal bought after the old plan already ended starts now.
	past := now.Add(-time.Hour)
	if start, _ := subscriptionPeriod(now, "renewal", &past, 30); !start.Equal(now) {
		t.Fatalf("late renewal start = %s; want now", start)
	}
}

func TestValidatePlanEnforcesTierOrdering(t *testing.T) {
	base := func(tier string, limit *int, enabled bool) PlanTerms {
		return PlanTerms{BusinessRole: "landlord", Tier: tier, Label: tier, Price: 1000, PeriodDays: 30, ListingLimit: limit, FairUseListingCap: 500, PhotoLimitPerListing: 10, Enabled: enabled}
	}
	silver := base("silver", intPtr(30), true)
	goldSame := base("gold", intPtr(30), true)
	if err := validatePlan(goldSame, map[string]PlanTerms{"silver": silver, "gold": goldSame}); err == nil {
		t.Fatal("enabling Gold with the same limit as Silver must be refused")
	}
	goldDisabled := base("gold", intPtr(30), false)
	if err := validatePlan(goldDisabled, map[string]PlanTerms{"silver": silver, "gold": goldDisabled}); err != nil {
		t.Fatalf("a disabled placeholder Gold plan may be saved: %v", err)
	}
	gold := base("gold", intPtr(60), true)
	platinum := base("platinum", nil, true)
	if err := validatePlan(platinum, map[string]PlanTerms{"silver": silver, "gold": gold, "platinum": platinum}); err != nil {
		t.Fatalf("valid ladder rejected: %v", err)
	}
	video := base("gold", intPtr(60), true)
	video.VideoEnabled = true
	if err := validatePlan(video, map[string]PlanTerms{"silver": silver, "gold": video}); err == nil {
		t.Fatal("video plans need explicit limits")
	}
	unknown := base("silver", intPtr(30), true)
	unknown.Features = []string{"free_money"}
	if err := validatePlan(unknown, map[string]PlanTerms{"silver": unknown}); err == nil {
		t.Fatal("unknown features must be rejected")
	}
}

func TestBusinessRoleFor(t *testing.T) {
	cases := map[string]CurrentUser{
		"landlord":       {Role: "property_owner", WorkspaceKind: "landlord"},
		"property_owner": {Role: "property_owner", WorkspaceKind: "property_owner"},
		"komisiyoneri":   {Role: "komisiyoneri"},
		"":               {Role: "tenant"},
	}
	for want, user := range cases {
		if got := businessRoleFor(user); got != want {
			t.Fatalf("businessRoleFor(%+v) = %q; want %q", user, got, want)
		}
	}
	if got := businessRoleFor(CurrentUser{Role: "admin"}); got != "" {
		t.Fatalf("admins have no business role, got %q", got)
	}
}
