package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// This file is the single source of truth for what a business account may do.
// Publishing, checkout, featuring, and the plan/subscription endpoints all ask
// resolveEntitlements instead of querying payment tables directly.

const (
	sourceNone          = "none"
	sourceSubscription  = "subscription"
	sourceLegacyUpgrade = "legacy_upgrade"

	publishViaListingPayment = "listing_payment"
	publishViaPlan           = "plan"
	publishViaCredit         = "credit"
)

var errPublishPaymentRequired = errors.New("payment required: buy a plan, pay for this listing, or use a listing credit")

// knownPlanFeatures is the closed set of feature keys a plan may grant. The UI
// translates keys into role-specific copy; the backend enforces them.
var knownPlanFeatures = map[string]bool{
	"photo_uploads": true, "video_uploads": true, "basic_analytics": true, "advanced_analytics": true,
	"business_analytics": true, "standard_promotion": true, "recommended_eligible": true, "search_boost": true,
	"priority_inquiries": true, "premium_presentation": true, "priority_support": true,
	"business_verification": true, "ad_free": true, "inventory_management": true,
	"tenant_management": true, "rent_tracking": true, "lead_management": true,
}

var tierRank = map[string]int{"free": 0, "silver": 1, "gold": 2, "platinum": 3}

// PlanTerms is what a subscriber is entitled to. It is snapshotted onto each
// subscription at purchase time.
type PlanTerms struct {
	PlanVersionID        string   `json:"plan_version_id"`
	BusinessRole         string   `json:"business_role"`
	Tier                 string   `json:"tier"`
	Version              int      `json:"version"`
	Label                string   `json:"label"`
	Description          string   `json:"description"`
	Price                float64  `json:"price"`
	Currency             string   `json:"currency"`
	PeriodDays           int      `json:"period_days"`
	ListingLimit         *int     `json:"listing_limit"`
	FairUseListingCap    int      `json:"fair_use_listing_cap"`
	PhotoLimitPerListing int      `json:"photo_limit_per_listing"`
	VideoEnabled         bool     `json:"video_enabled"`
	VideoLimitPerListing int      `json:"video_limit_per_listing"`
	MaxVideoSeconds      int      `json:"max_video_seconds"`
	MaxVideoMB           int      `json:"max_video_mb"`
	Features             []string `json:"features"`
	Benefits             []string `json:"benefits"`
	Enabled              bool     `json:"enabled"`
}

func (t PlanTerms) HasFeature(key string) bool {
	for _, feature := range t.Features {
		if feature == key {
			return true
		}
	}
	return false
}

type Entitlements struct {
	BusinessRole       string     `json:"business_role"`
	Tier               string     `json:"tier"`
	Source             string     `json:"source"`
	SubscriptionID     string     `json:"subscription_id,omitempty"`
	PeriodStart        *time.Time `json:"period_start,omitempty"`
	PeriodEnd          *time.Time `json:"period_end,omitempty"`
	CancelAtPeriodEnd  bool       `json:"cancel_at_period_end"`
	Terms              *PlanTerms `json:"terms,omitempty"`
	PlanListingsActive int        `json:"plan_listings_active"`
	// AllowanceRemaining is how many more listings the plan can publish now.
	// For unlimited plans it is the remaining fair-use headroom.
	AllowanceRemaining int  `json:"allowance_remaining"`
	UnlimitedListings  bool `json:"unlimited_listings"`
	AvailableCredits   int  `json:"available_credits"`
	CanFeature         bool `json:"can_feature"`
}

// planAllowanceRemaining returns how many more listings a plan may publish.
func planAllowanceRemaining(terms *PlanTerms, activePlanListings int) (remaining int, unlimited bool) {
	if terms == nil {
		return 0, false
	}
	limit := terms.FairUseListingCap
	unlimited = terms.ListingLimit == nil
	if !unlimited && *terms.ListingLimit < limit {
		limit = *terms.ListingLimit
	}
	remaining = limit - activePlanListings
	if remaining < 0 {
		remaining = 0
	}
	return remaining, unlimited
}

// choosePublishEntitlement decides how a draft gets published. Order matters:
//  1. A listing that was already paid for individually uses that payment.
//  2. Otherwise an active plan with allowance covers it (already paid for).
//  3. Otherwise a prepaid listing credit is consumed.
//
// Using the plan before credits preserves the customer's prepaid credits.
func choosePublishEntitlement(listingAlreadyPaid bool, e Entitlements) (string, error) {
	switch {
	case listingAlreadyPaid:
		return publishViaListingPayment, nil
	case e.Source == sourceSubscription && e.AllowanceRemaining > 0:
		return publishViaPlan, nil
	case e.AvailableCredits > 0:
		return publishViaCredit, nil
	default:
		return "", errPublishPaymentRequired
	}
}

// coveredByPlan reports whether a per-listing payment would be a double charge.
func coveredByPlan(e Entitlements) bool {
	return e.Source == sourceSubscription && e.AllowanceRemaining > 0
}

// classifyPlanChange compares the currently active tier with the purchased one.
func classifyPlanChange(currentTier, nextTier string) string {
	current, next := tierRank[currentTier], tierRank[nextTier]
	switch {
	case current == 0:
		return "new"
	case next > current:
		return "upgrade"
	case next < current:
		return "downgrade"
	default:
		return "renewal"
	}
}

// subscriptionPeriod applies the plan change policy: new plans and upgrades
// start immediately; renewals and downgrades start when the current paid
// period ends, so the customer never loses days they already paid for.
func subscriptionPeriod(now time.Time, changeKind string, currentEnd *time.Time, periodDays int) (time.Time, time.Time) {
	start := now
	if (changeKind == "renewal" || changeKind == "downgrade") && currentEnd != nil && currentEnd.After(now) {
		start = *currentEnd
	}
	return start, start.Add(time.Duration(periodDays) * 24 * time.Hour)
}

// businessRoleFor maps an account to the business role its plans apply to.
// Clients, tenants, and admins have no business role.
func businessRoleFor(user CurrentUser) string {
	switch postingRole(user) {
	case "landlord", "property_owner", "komisiyoneri":
		return postingRole(user)
	default:
		return ""
	}
}

type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

const planTermsColumns = `id::text,business_role,tier,version,label,description,price,currency,period_days,listing_limit,fair_use_listing_cap,photo_limit_per_listing,video_enabled,video_limit_per_listing,max_video_seconds,max_video_mb,features,benefits,enabled`

func scanPlanTerms(row pgx.Row) (PlanTerms, error) {
	var terms PlanTerms
	var features, benefits []byte
	err := row.Scan(&terms.PlanVersionID, &terms.BusinessRole, &terms.Tier, &terms.Version, &terms.Label, &terms.Description, &terms.Price, &terms.Currency, &terms.PeriodDays, &terms.ListingLimit, &terms.FairUseListingCap, &terms.PhotoLimitPerListing, &terms.VideoEnabled, &terms.VideoLimitPerListing, &terms.MaxVideoSeconds, &terms.MaxVideoMB, &features, &benefits, &terms.Enabled)
	if err != nil {
		return PlanTerms{}, err
	}
	_ = json.Unmarshal(features, &terms.Features)
	_ = json.Unmarshal(benefits, &terms.Benefits)
	if terms.Features == nil {
		terms.Features = []string{}
	}
	if terms.Benefits == nil {
		terms.Benefits = []string{}
	}
	return terms, nil
}

func currentPlanTerms(ctx context.Context, q rowQuerier, businessRole, tier string) (PlanTerms, error) {
	return scanPlanTerms(q.QueryRow(ctx, `SELECT `+planTermsColumns+` FROM plan_versions WHERE business_role=$1 AND tier=$2 AND is_current`, businessRole, tier))
}

// resolveEntitlements loads the effective entitlements for a user. Pass a
// transaction when the result gates a write.
func resolveEntitlements(ctx context.Context, q rowQuerier, user CurrentUser) (Entitlements, error) {
	e := Entitlements{BusinessRole: businessRoleFor(user), Tier: "free", Source: sourceNone}
	if e.BusinessRole == "" {
		return e, nil
	}
	var subscriptionID, tier string
	var startsAt, endsAt *time.Time
	var snapshot []byte
	err := q.QueryRow(ctx, `SELECT id::text,tier,starts_at,ends_at,entitlements,cancel_at_period_end FROM subscriptions
		WHERE user_id=$1 AND status='active' AND (business_role=$2 OR business_role IS NULL)
		AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at > NOW())
		ORDER BY CASE tier WHEN 'platinum' THEN 3 WHEN 'gold' THEN 2 ELSE 1 END DESC, ends_at DESC NULLS FIRST LIMIT 1`,
		user.ID, e.BusinessRole).Scan(&subscriptionID, &tier, &startsAt, &endsAt, &snapshot, &e.CancelAtPeriodEnd)
	switch {
	case err == nil:
		e.Source, e.Tier, e.SubscriptionID, e.PeriodStart, e.PeriodEnd, e.CanFeature = sourceSubscription, tier, subscriptionID, startsAt, endsAt, true
		var terms PlanTerms
		if len(snapshot) > 0 && json.Unmarshal(snapshot, &terms) == nil && terms.PlanVersionID != "" {
			e.Terms = &terms
		} else if current, err := currentPlanTerms(ctx, q, e.BusinessRole, tier); err == nil {
			// Subscriptions created before plan versioning use current terms.
			e.Terms = &current
		}
	case errors.Is(err, pgx.ErrNoRows):
		// Owner upgrades sold before business plans existed keep exactly the
		// benefit they were sold with (featuring) and grant no listing allowance.
		var legacyTier string
		var legacyEnd *time.Time
		legacyErr := q.QueryRow(ctx, `SELECT plan,expires_at FROM owner_upgrade_purchases WHERE owner_id=$1 AND status='active' AND plan<>'diamond' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1`, user.ID).Scan(&legacyTier, &legacyEnd)
		if legacyErr == nil {
			e.Source, e.Tier, e.PeriodEnd, e.CanFeature = sourceLegacyUpgrade, legacyTier, legacyEnd, true
		} else if !errors.Is(legacyErr, pgx.ErrNoRows) {
			return Entitlements{}, legacyErr
		}
	default:
		return Entitlements{}, err
	}
	if err := q.QueryRow(ctx, `SELECT COUNT(*) FROM listings WHERE owner_id=$1 AND entitlement_source='plan' AND status IN ('published','scheduled') AND deleted_at IS NULL`, user.ID).Scan(&e.PlanListingsActive); err != nil {
		return Entitlements{}, err
	}
	if err := q.QueryRow(ctx, `SELECT COUNT(*) FROM listing_upload_slots WHERE owner_id=$1 AND status='available'`, user.ID).Scan(&e.AvailableCredits); err != nil {
		return Entitlements{}, err
	}
	if e.Source == sourceSubscription {
		e.AllowanceRemaining, e.UnlimitedListings = planAllowanceRemaining(e.Terms, e.PlanListingsActive)
	}
	return e, nil
}
