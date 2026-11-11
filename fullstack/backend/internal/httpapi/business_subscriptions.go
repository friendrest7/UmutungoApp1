package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Routes:
//   GET   /api/v1/plans                                  public, enabled current plans
//   GET   /api/v1/business/entitlements                  current plan, allowance, history
//   POST  /api/v1/business/subscriptions                 start a plan purchase
//   PATCH /api/v1/business/subscriptions/{id}            toggle cancel_at_period_end
//   GET   /api/v1/business/subscription-payments/verify  Flutterwave return URL
//   GET/PUT /api/v1/admin/business-plans                 admin plan editor

const businessSubscriptionPayment = "business_subscription"

var validBusinessRoles = map[string]bool{"landlord": true, "property_owner": true, "komisiyoneri": true}
var validTiers = map[string]bool{"silver": true, "gold": true, "platinum": true}

func (s *Server) publicPlans(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "use GET")
		return
	}
	role := strings.TrimSpace(r.URL.Query().Get("role"))
	if role != "" && !validBusinessRoles[role] {
		errorJSON(w, http.StatusBadRequest, "role must be landlord, property_owner, or komisiyoneri")
		return
	}
	plans, err := s.loadPlans(r.Context(), role, true)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load plans")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"plans": plans})
}

func (s *Server) loadPlans(ctx context.Context, role string, enabledOnly bool) ([]PlanTerms, error) {
	rows, err := s.db.Query(ctx, `SELECT `+planTermsColumns+` FROM plan_versions WHERE is_current AND ($1='' OR business_role=$1) AND (NOT $2 OR enabled)
		ORDER BY business_role, CASE tier WHEN 'silver' THEN 1 WHEN 'gold' THEN 2 ELSE 3 END`, role, enabledOnly)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	plans := make([]PlanTerms, 0)
	for rows.Next() {
		terms, err := scanPlanTerms(rows)
		if err != nil {
			return nil, err
		}
		plans = append(plans, terms)
	}
	return plans, rows.Err()
}

func (s *Server) graceDays(ctx context.Context, q rowQuerier) int {
	var days int
	if err := q.QueryRow(ctx, `SELECT (value #>> '{}')::int FROM platform_settings WHERE key='subscription_grace_days'`).Scan(&days); err != nil || days < 0 {
		return 3
	}
	return days
}

func (s *Server) businessEntitlements(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "use GET")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	role := businessRoleFor(user)
	if role == "" {
		errorJSON(w, http.StatusForbidden, "plans are available to Landlord, Property Owner, and Komisiyoneri accounts")
		return
	}
	entitlements, err := resolveEntitlements(r.Context(), s.db, user)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load your plan")
		return
	}
	plans, err := s.loadPlans(r.Context(), role, true)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load plans")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT s.id::text,s.tier,s.status,s.change_kind,COALESCE(s.amount,0),s.currency,s.starts_at,s.ends_at,s.cancel_at_period_end,s.created_at,
		COALESCE(p.status,''),COALESCE(p.provider,''),COALESCE(p.receipt_number,'')
		FROM subscriptions s LEFT JOIN payments p ON p.id=s.payment_id
		WHERE s.user_id=$1 AND (s.business_role=$2 OR s.business_role IS NULL) ORDER BY s.created_at DESC LIMIT 50`, user.ID, role)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load subscription history")
		return
	}
	defer rows.Close()
	history := make([]map[string]any, 0)
	for rows.Next() {
		var id, tier, status, changeKind, currency, paymentStatus, provider, receipt string
		var amount float64
		var startsAt, endsAt *time.Time
		var cancelAtEnd bool
		var createdAt time.Time
		if err := rows.Scan(&id, &tier, &status, &changeKind, &amount, &currency, &startsAt, &endsAt, &cancelAtEnd, &createdAt, &paymentStatus, &provider, &receipt); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not read subscription history")
			return
		}
		history = append(history, map[string]any{"id": id, "tier": tier, "status": status, "change_kind": changeKind, "amount": amount, "currency": currency, "starts_at": startsAt, "ends_at": endsAt, "cancel_at_period_end": cancelAtEnd, "created_at": createdAt, "payment_status": paymentStatus, "provider": provider, "receipt_number": receipt, "is_demo": provider == "demo"})
	}
	writeJSON(w, http.StatusOK, map[string]any{"entitlements": entitlements, "plans": plans, "history": history, "grace_days": s.graceDays(r.Context(), s.db), "demo_payments": s.cfg.DemoPaymentsEnabled})
}

func (s *Server) businessSubscriptions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use POST")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "sign in to choose a plan")
		return
	}
	role := businessRoleFor(user)
	if role == "" {
		errorJSON(w, http.StatusForbidden, "plans are available to Landlord, Property Owner, and Komisiyoneri accounts")
		return
	}
	var input struct {
		Tier           string `json:"tier"`
		Method         string `json:"payment_method"`
		Email          string `json:"email"`
		Phone          string `json:"phone"`
		IdempotencyKey string `json:"idempotency_key"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	input.Tier = strings.ToLower(strings.TrimSpace(input.Tier))
	input.Method = strings.ToLower(strings.TrimSpace(input.Method))
	input.IdempotencyKey = strings.TrimSpace(input.IdempotencyKey)
	if !validTiers[input.Tier] {
		errorJSON(w, http.StatusBadRequest, "choose Silver, Gold, or Platinum")
		return
	}
	if input.IdempotencyKey == "" || len(input.IdempotencyKey) > 120 {
		errorJSON(w, http.StatusBadRequest, "an idempotency key is required")
		return
	}
	provider := "flutterwave"
	phone := ""
	switch input.Method {
	case "demo":
		if !s.cfg.DemoPaymentsEnabled {
			errorJSON(w, http.StatusBadRequest, "choose bank card or Rwanda mobile money")
			return
		}
		provider = "demo"
	case "card":
		if _, err := mail.ParseAddress(strings.TrimSpace(input.Email)); err != nil {
			errorJSON(w, http.StatusBadRequest, "enter a valid email address for bank card checkout")
			return
		}
	case "mobilemoneyrwanda":
		normalized, err := normalizeRwandaPhone(input.Phone)
		if err != nil {
			errorJSON(w, http.StatusBadRequest, "enter a valid Rwanda phone number for mobile money")
			return
		}
		phone = normalized
		if strings.TrimSpace(input.Email) == "" {
			input.Email = strings.TrimSpace(user.Email)
		}
		if _, err := mail.ParseAddress(strings.TrimSpace(input.Email)); err != nil {
			errorJSON(w, http.StatusBadRequest, "enter an email address for the payment receipt")
			return
		}
	default:
		errorJSON(w, http.StatusBadRequest, "choose bank card or Rwanda mobile money")
		return
	}

	ctx := r.Context()
	var existingID, existingStatus string
	switch err := s.db.QueryRow(ctx, `SELECT id::text,status FROM subscriptions WHERE user_id=$1 AND idempotency_key=$2`, user.ID, input.IdempotencyKey).Scan(&existingID, &existingStatus); {
	case err == nil:
		if existingStatus == "active" {
			writeJSON(w, http.StatusOK, map[string]any{"id": existingID, "status": "active", "idempotent_replay": true})
			return
		}
		errorJSON(w, http.StatusConflict, "this plan payment was already started; check its status before retrying")
		return
	case !errors.Is(err, pgx.ErrNoRows):
		errorJSON(w, http.StatusInternalServerError, "could not check previous plan purchases")
		return
	}

	terms, err := currentPlanTerms(ctx, s.db, role, input.Tier)
	if err != nil || !terms.Enabled {
		errorJSON(w, http.StatusNotFound, "this plan is not available yet")
		return
	}
	entitlements, err := resolveEntitlements(ctx, s.db, user)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load your current plan")
		return
	}
	currentTier := "free"
	if entitlements.Source == sourceSubscription {
		currentTier = entitlements.Tier
	}
	changeKind := classifyPlanChange(currentTier, input.Tier)

	// Release abandoned checkouts, then refuse overlapping purchases.
	_, _ = s.db.Exec(ctx, `UPDATE payments SET status='expired' WHERE user_id=$1 AND related_type=$2 AND status='pending' AND expires_at <= NOW()`, user.ID, businessSubscriptionPayment)
	_, _ = s.db.Exec(ctx, `UPDATE subscriptions s SET status='failed',updated_at=NOW() FROM payments p WHERE p.id=s.payment_id AND s.user_id=$1 AND s.status='pending' AND p.status IN ('expired','failed','cancelled')`, user.ID)
	var pendingExists bool
	var scheduledStart *time.Time
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM subscriptions WHERE user_id=$1 AND status='pending'),
		(SELECT MIN(starts_at) FROM subscriptions WHERE user_id=$1 AND business_role=$2 AND status='active' AND starts_at > NOW())`, user.ID, role).Scan(&pendingExists, &scheduledStart); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not check your plan status")
		return
	}
	if pendingExists {
		errorJSON(w, http.StatusConflict, "a plan payment is already in progress. Finish that checkout or wait 30 minutes for it to expire")
		return
	}
	if scheduledStart != nil {
		errorJSON(w, http.StatusConflict, fmt.Sprintf("you already have a plan scheduled to start on %s. You can change plans after it starts", scheduledStart.Format("2 Jan 2006")))
		return
	}

	token, err := randomToken()
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create payment reference")
		return
	}
	txRef := "UM-PLAN-" + strings.ToUpper(token[:24])
	if provider == "demo" {
		txRef = "UM-DEMO-PLAN-" + strings.ToUpper(token[:20])
	}
	snapshot, _ := json.Marshal(terms)
	amount := math.Round(terms.Price)
	tx, err := s.db.Begin(ctx)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start plan payment")
		return
	}
	defer tx.Rollback(ctx)
	var subscriptionID, paymentID string
	if err := tx.QueryRow(ctx, `INSERT INTO subscriptions(user_id,tier,status,business_role,plan_version_id,amount,currency,entitlements,change_kind,idempotency_key)
		VALUES($1,$2,'pending',$3,$4,$5,'RWF',$6,$7,$8) RETURNING id::text`, user.ID, input.Tier, role, terms.PlanVersionID, amount, snapshot, changeKind, input.IdempotencyKey).Scan(&subscriptionID); err != nil {
		errorJSON(w, http.StatusConflict, "could not save the plan purchase")
		return
	}
	if err := tx.QueryRow(ctx, `INSERT INTO payments(user_id,related_type,related_id,amount,currency,provider,provider_reference,status,expires_at)
		VALUES($1,$2,$3,$4,'RWF',$5,$6,'pending',NOW()+INTERVAL '30 minutes') RETURNING id::text`, user.ID, businessSubscriptionPayment, subscriptionID, amount, provider, txRef).Scan(&paymentID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save the plan payment")
		return
	}
	if _, err := tx.Exec(ctx, `UPDATE subscriptions SET payment_id=$2 WHERE id=$1`, subscriptionID, paymentID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not link the plan payment")
		return
	}
	if err := tx.Commit(ctx); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start plan payment")
		return
	}
	response := map[string]any{"id": subscriptionID, "payment_id": paymentID, "tier": input.Tier, "amount": amount, "currency": "RWF", "change_kind": changeKind}

	if provider == "demo" {
		if err := s.activateBusinessSubscription(ctx, paymentID, txRef); err != nil {
			log.Printf("demo plan activation failed for subscription %s: %v", subscriptionID, err)
			s.failBusinessSubscriptionPayment(ctx, paymentID, "failed")
			errorJSON(w, http.StatusConflict, "the demo plan could not be activated")
			return
		}
		response["status"] = "active"
		response["is_demo"] = true
		response["message"] = "Demo plan activated. This is not a real charge."
		writeJSON(w, http.StatusOK, response)
		return
	}
	checkoutURL, err := newFlutterwaveClient(s.cfg.FlutterwaveSecretKey).startCheckoutFor(ctx, txRef, strings.TrimSpace(input.Email), user.Name,
		s.cfg.BackendPublicURL+"/api/v1/business/subscription-payments/verify", input.Method, phone, amount,
		map[string]string{"title": "Umutungo " + terms.Label + " plan", "description": fmt.Sprintf("%s plan for %d days", terms.Label, terms.PeriodDays)},
		map[string]string{"subscription_id": subscriptionID, "payment_type": businessSubscriptionPayment})
	if err != nil {
		s.failBusinessSubscriptionPayment(ctx, paymentID, "failed")
		errorJSON(w, http.StatusBadGateway, err.Error())
		return
	}
	response["status"] = "pending"
	response["checkout_url"] = checkoutURL
	writeJSON(w, http.StatusCreated, response)
}

func (s *Server) failBusinessSubscriptionPayment(ctx context.Context, paymentID, status string) {
	_, _ = s.db.Exec(ctx, `UPDATE payments SET status=$2 WHERE id=$1 AND status='pending'`, paymentID, status)
	_, _ = s.db.Exec(ctx, `UPDATE subscriptions SET status='failed',updated_at=NOW() WHERE payment_id=$1 AND status='pending'`, paymentID)
}

// activateBusinessSubscription applies a verified payment exactly once. A
// repeated call for an already-active subscription is a successful no-op.
func (s *Server) activateBusinessSubscription(ctx context.Context, paymentID, providerTransactionID string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var paymentStatus, userID, subscriptionID, subscriptionStatus, role, tier string
	var snapshot []byte
	if err := tx.QueryRow(ctx, `SELECT p.status,p.user_id::text,s.id::text,s.status,s.business_role,s.tier,s.entitlements
		FROM payments p JOIN subscriptions s ON s.payment_id=p.id WHERE p.id=$1 FOR UPDATE OF p,s`, paymentID).
		Scan(&paymentStatus, &userID, &subscriptionID, &subscriptionStatus, &role, &tier, &snapshot); err != nil {
		return err
	}
	if paymentStatus == "successful" && subscriptionStatus != "pending" {
		return tx.Commit(ctx)
	}
	if paymentStatus != "pending" || subscriptionStatus != "pending" {
		return fmt.Errorf("plan payment is no longer pending")
	}
	var terms PlanTerms
	if err := json.Unmarshal(snapshot, &terms); err != nil || terms.PeriodDays < 1 {
		return fmt.Errorf("plan terms are missing")
	}
	// Serialise plan changes for this account.
	if _, err := tx.Exec(ctx, `SELECT 1 FROM users WHERE id=$1 FOR UPDATE`, userID); err != nil {
		return err
	}
	currentTier := "free"
	var currentID string
	var currentEnd *time.Time
	err = tx.QueryRow(ctx, `SELECT id::text,tier,ends_at FROM subscriptions WHERE user_id=$1 AND business_role=$2 AND status='active' AND id<>$3
		AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at > NOW())
		ORDER BY CASE tier WHEN 'platinum' THEN 3 WHEN 'gold' THEN 2 ELSE 1 END DESC LIMIT 1`, userID, role, subscriptionID).Scan(&currentID, &currentTier, &currentEnd)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	var latestEnd *time.Time
	if err := tx.QueryRow(ctx, `SELECT MAX(ends_at) FROM subscriptions WHERE user_id=$1 AND business_role=$2 AND status='active' AND id<>$3 AND ends_at > NOW()`, userID, role, subscriptionID).Scan(&latestEnd); err != nil {
		return err
	}
	now := time.Now().UTC()
	changeKind := classifyPlanChange(currentTier, tier)
	startsAt, endsAt := subscriptionPeriod(now, changeKind, latestEnd, terms.PeriodDays)
	if changeKind == "upgrade" && currentID != "" {
		// The upgraded plan replaces the current one immediately. Any plan
		// already scheduled after it moves to start when the upgrade ends.
		if _, err := tx.Exec(ctx, `UPDATE subscriptions SET status='superseded',superseded_by=$2,updated_at=NOW() WHERE id=$1`, currentID, subscriptionID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE subscriptions SET ends_at=$3::timestamptz+(ends_at-starts_at),starts_at=$3::timestamptz,updated_at=NOW() WHERE user_id=$1 AND business_role=$2 AND status='active' AND starts_at > NOW()`, userID, role, endsAt); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE subscriptions SET status='active',starts_at=$2,ends_at=$3,activated_at=NOW(),change_kind=$4,updated_at=NOW() WHERE id=$1`, subscriptionID, startsAt, endsAt, changeKind); err != nil {
		return err
	}
	receipt := "UMR-" + now.Format("20060102") + "-" + strings.ToUpper(strings.ReplaceAll(subscriptionID, "-", "")[:10])
	if _, err := tx.Exec(ctx, `UPDATE payments SET status='successful',provider_transaction_id=NULLIF($2,''),receipt_number=$3 WHERE id=$1 AND status='pending'`, paymentID, providerTransactionID, receipt); err != nil {
		return err
	}
	body := fmt.Sprintf("Your %s plan is active until %s.", terms.Label, endsAt.Format("2 Jan 2006"))
	if startsAt.After(now) {
		body = fmt.Sprintf("Your %s plan starts on %s, when your current plan ends.", terms.Label, startsAt.Format("2 Jan 2006"))
	}
	if _, err := tx.Exec(ctx, `INSERT INTO notifications(user_id,type,title,body) VALUES($1,'subscription_active','Plan payment confirmed',$2)`, userID, body); err != nil {
		return err
	}
	if err := writeAudit(ctx, tx, userID, "subscription.activated", "subscription", subscriptionID, nil,
		map[string]any{"tier": tier, "business_role": role, "change_kind": changeKind, "starts_at": startsAt, "ends_at": endsAt, "payment_id": paymentID}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Server) verifyBusinessSubscriptionPayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "use GET for the payment return")
		return
	}
	ctx := r.Context()
	query := r.URL.Query()
	txRef := strings.TrimSpace(query.Get("tx_ref"))
	transactionID := strings.TrimSpace(query.Get("transaction_id"))
	statusParam := strings.ToLower(strings.TrimSpace(query.Get("status")))
	state := "failed"
	var paymentID, subscriptionID, paymentStatus string
	var amount float64
	if txRef != "" {
		_ = s.db.QueryRow(ctx, `SELECT p.id::text,COALESCE(p.related_id::text,''),p.status,p.amount FROM payments p WHERE p.provider='flutterwave' AND p.provider_reference=$1 AND p.related_type=$2`, txRef, businessSubscriptionPayment).Scan(&paymentID, &subscriptionID, &paymentStatus, &amount)
	}
	switch {
	case paymentID == "":
		// Unknown reference: never activate anything.
	case paymentStatus == "successful":
		state = "successful"
	case statusParam == "cancelled":
		s.failBusinessSubscriptionPayment(ctx, paymentID, "cancelled")
		state = "cancelled"
	case transactionID != "" && (statusParam == "successful" || statusParam == "pending" || statusParam == "completed"):
		verified, err := newFlutterwaveClient(s.cfg.FlutterwaveSecretKey).verify(ctx, transactionID)
		if err != nil || verified.TxRef != txRef || !strings.EqualFold(verified.Currency, "RWF") || math.Abs(verified.Amount-amount) >= 0.01 {
			// Do not fail the payment on a verification error; it may still settle.
			state = "pending"
			break
		}
		switch strings.ToLower(verified.Status) {
		case "successful":
			if err := s.activateBusinessSubscription(ctx, paymentID, fmt.Sprint(verified.ID)); err != nil {
				log.Printf("plan activation failed for payment %s: %v", paymentID, err)
				state = "pending"
			} else {
				state = "successful"
			}
		case "pending":
			state = "pending"
		default:
			s.failBusinessSubscriptionPayment(ctx, paymentID, "failed")
		}
	default:
		s.failBusinessSubscriptionPayment(ctx, paymentID, "failed")
	}
	returnURL := s.cfg.FrontendBaseURL + "/upgrade?payment=" + url.QueryEscape(state) + "&subscription_id=" + url.QueryEscape(subscriptionID)
	if state == "pending" {
		returnURL += "&tx_ref=" + url.QueryEscape(txRef) + "&transaction_id=" + url.QueryEscape(transactionID)
	}
	http.Redirect(w, r, returnURL, http.StatusSeeOther)
}

func (s *Server) businessSubscriptionItem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		errorJSON(w, http.StatusMethodNotAllowed, "use PATCH")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/business/subscriptions/"), "/")
	if id == "" || strings.Contains(id, "/") {
		errorJSON(w, http.StatusNotFound, "subscription not found")
		return
	}
	var input struct {
		CancelAtPeriodEnd *bool `json:"cancel_at_period_end"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if input.CancelAtPeriodEnd == nil {
		errorJSON(w, http.StatusBadRequest, "cancel_at_period_end is required")
		return
	}
	var endsAt *time.Time
	err := s.db.QueryRow(r.Context(), `UPDATE subscriptions SET cancel_at_period_end=$3,updated_at=NOW() WHERE id::text=$1 AND user_id=$2 AND status='active' RETURNING ends_at`, id, user.ID, *input.CancelAtPeriodEnd).Scan(&endsAt)
	if err != nil {
		errorJSON(w, http.StatusNotFound, "active subscription not found")
		return
	}
	_ = writeAudit(r.Context(), s.db, user.ID, "subscription.cancel_at_period_end", "subscription", id, nil, map[string]any{"cancel_at_period_end": *input.CancelAtPeriodEnd})
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "cancel_at_period_end": *input.CancelAtPeriodEnd, "ends_at": endsAt,
		"message": "Your plan stays active until the end of the period you paid for. No refund is issued for unused days."})
}

// --- Admin plan editor ---------------------------------------------------

type planInput struct {
	BusinessRole         string   `json:"business_role"`
	Tier                 string   `json:"tier"`
	Label                string   `json:"label"`
	Description          string   `json:"description"`
	Price                float64  `json:"price"`
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

func (in planInput) terms() PlanTerms {
	return PlanTerms{BusinessRole: in.BusinessRole, Tier: in.Tier, Label: in.Label, Description: in.Description, Price: in.Price, Currency: "RWF",
		PeriodDays: in.PeriodDays, ListingLimit: in.ListingLimit, FairUseListingCap: in.FairUseListingCap, PhotoLimitPerListing: in.PhotoLimitPerListing,
		VideoEnabled: in.VideoEnabled, VideoLimitPerListing: in.VideoLimitPerListing, MaxVideoSeconds: in.MaxVideoSeconds, MaxVideoMB: in.MaxVideoMB,
		Features: in.Features, Benefits: in.Benefits, Enabled: in.Enabled}
}

// validatePlan checks one plan on its own and against the other tiers of the
// same role (map keyed by tier, already including the edited plan).
func validatePlan(in PlanTerms, sameRole map[string]PlanTerms) error {
	switch {
	case !validBusinessRoles[in.BusinessRole] || !validTiers[in.Tier]:
		return fmt.Errorf("unknown role or tier")
	case strings.TrimSpace(in.Label) == "" || len(in.Label) > 80:
		return fmt.Errorf("label is required (up to 80 characters)")
	case len(in.Description) > 2000:
		return fmt.Errorf("description is too long")
	case in.Price <= 0 || math.IsNaN(in.Price) || math.IsInf(in.Price, 0):
		return fmt.Errorf("price must be greater than zero")
	case in.PeriodDays < 1 || in.PeriodDays > 366:
		return fmt.Errorf("period must be between 1 and 366 days")
	case in.ListingLimit != nil && *in.ListingLimit < 0:
		return fmt.Errorf("listing limit cannot be negative")
	case in.FairUseListingCap < 1:
		return fmt.Errorf("fair-use cap must be at least 1")
	case in.PhotoLimitPerListing < 1:
		return fmt.Errorf("photo limit must be at least 1")
	case in.VideoEnabled && (in.VideoLimitPerListing < 1 || in.MaxVideoSeconds < 1 || in.MaxVideoMB < 1):
		return fmt.Errorf("video plans need a video count, maximum length, and maximum size")
	}
	for _, feature := range in.Features {
		if !knownPlanFeatures[feature] {
			return fmt.Errorf("unknown feature %q", feature)
		}
	}
	effective := func(t PlanTerms) int {
		if t.ListingLimit == nil {
			return math.MaxInt
		}
		return *t.ListingLimit
	}
	silver, hasSilver := sameRole["silver"]
	gold, hasGold := sameRole["gold"]
	platinum, hasPlatinum := sameRole["platinum"]
	if hasSilver && hasGold && gold.Enabled && effective(gold) <= effective(silver) {
		return fmt.Errorf("Gold must allow more listings than Silver before it can be enabled")
	}
	if hasGold && hasPlatinum && platinum.Enabled && effective(platinum) < effective(gold) {
		return fmt.Errorf("Platinum must allow at least as many listings as Gold")
	}
	return nil
}

func (s *Server) adminBusinessPlans(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "admin access required")
		return
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		plans, err := s.loadPlans(ctx, "", false)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not load plans")
			return
		}
		var activeCounts = map[string]int{}
		rows, err := s.db.Query(ctx, `SELECT plan_version_id::text,COUNT(*) FROM subscriptions WHERE status='active' AND plan_version_id IS NOT NULL GROUP BY plan_version_id`)
		if err == nil {
			for rows.Next() {
				var id string
				var count int
				if rows.Scan(&id, &count) == nil {
					activeCounts[id] = count
				}
			}
			rows.Close()
		}
		features := make([]string, 0, len(knownPlanFeatures))
		for key := range knownPlanFeatures {
			features = append(features, key)
		}
		writeJSON(w, http.StatusOK, map[string]any{"plans": plans, "active_subscribers_by_version": activeCounts, "grace_days": s.graceDays(ctx, s.db), "known_features": features})
		return
	}
	if r.Method != http.MethodPut {
		errorJSON(w, http.StatusMethodNotAllowed, "use GET or PUT")
		return
	}
	var input struct {
		Plans     []planInput `json:"plans"`
		GraceDays *int        `json:"grace_days"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if input.GraceDays != nil && (*input.GraceDays < 0 || *input.GraceDays > 60) {
		errorJSON(w, http.StatusBadRequest, "grace period must be between 0 and 60 days")
		return
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save plans")
		return
	}
	defer tx.Rollback(ctx)
	changed := make([]PlanTerms, 0, len(input.Plans))
	for _, in := range input.Plans {
		in.BusinessRole = strings.TrimSpace(in.BusinessRole)
		in.Tier = strings.ToLower(strings.TrimSpace(in.Tier))
		in.Label = strings.TrimSpace(in.Label)
		if in.FairUseListingCap == 0 {
			in.FairUseListingCap = 500
		}
		if in.Features == nil {
			in.Features = []string{}
		}
		if in.Benefits == nil {
			in.Benefits = []string{}
		}
		next := in.terms()
		sameRole := map[string]PlanTerms{}
		rows, err := tx.Query(ctx, `SELECT `+planTermsColumns+` FROM plan_versions WHERE business_role=$1 AND is_current FOR UPDATE`, in.BusinessRole)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not load current plans")
			return
		}
		for rows.Next() {
			terms, err := scanPlanTerms(rows)
			if err != nil {
				rows.Close()
				errorJSON(w, http.StatusInternalServerError, "could not read current plans")
				return
			}
			sameRole[terms.Tier] = terms
		}
		rows.Close()
		before, hadBefore := sameRole[in.Tier]
		sameRole[in.Tier] = next
		if err := validatePlan(next, sameRole); err != nil {
			errorJSON(w, http.StatusBadRequest, fmt.Sprintf("%s %s: %v", in.BusinessRole, in.Tier, err))
			return
		}
		features, _ := json.Marshal(next.Features)
		benefits, _ := json.Marshal(next.Benefits)
		if _, err := tx.Exec(ctx, `UPDATE plan_versions SET is_current=FALSE WHERE business_role=$1 AND tier=$2 AND is_current`, in.BusinessRole, in.Tier); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not retire the previous plan version")
			return
		}
		if err := tx.QueryRow(ctx, `INSERT INTO plan_versions(business_role,tier,version,label,description,price,period_days,listing_limit,fair_use_listing_cap,photo_limit_per_listing,video_enabled,video_limit_per_listing,max_video_seconds,max_video_mb,features,benefits,enabled,is_current,created_by)
			VALUES($1,$2,(SELECT COALESCE(MAX(version),0)+1 FROM plan_versions WHERE business_role=$1 AND tier=$2),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,TRUE,$17)
			RETURNING id::text,version`, in.BusinessRole, in.Tier, next.Label, next.Description, next.Price, next.PeriodDays, next.ListingLimit, next.FairUseListingCap, next.PhotoLimitPerListing,
			next.VideoEnabled, next.VideoLimitPerListing, next.MaxVideoSeconds, next.MaxVideoMB, features, benefits, next.Enabled, user.ID).Scan(&next.PlanVersionID, &next.Version); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not save the plan")
			return
		}
		var beforeState any
		if hadBefore {
			beforeState = before
		}
		if err := writeAudit(ctx, tx, user.ID, "plan.updated", "plan_version", next.PlanVersionID, beforeState, next); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not record the change")
			return
		}
		changed = append(changed, next)
	}
	if input.GraceDays != nil {
		before := s.graceDays(ctx, tx)
		if _, err := tx.Exec(ctx, `INSERT INTO platform_settings(key,value,updated_by,updated_at) VALUES('subscription_grace_days',to_jsonb($1::int),$2,NOW())
			ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`, *input.GraceDays, user.ID); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not save the grace period")
			return
		}
		if err := writeAudit(ctx, tx, user.ID, "setting.updated", "platform_setting", "", map[string]any{"subscription_grace_days": before}, map[string]any{"subscription_grace_days": *input.GraceDays}); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not record the change")
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save plans")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "saved", "plans": changed,
		"note": "Existing subscribers keep the terms they paid for until their period ends; new purchases use the new version."})
}

// --- Scheduled jobs ------------------------------------------------------

// expireBusinessSubscriptions ends lapsed plans and pauses (never deletes)
// listings that are no longer covered: after the grace period for lapsed
// plans, and immediately for listings above a smaller plan's allowance
// (newest listings are paused first).
func (s *Server) expireBusinessSubscriptions(ctx context.Context) error {
	if _, err := s.db.Exec(ctx, `WITH expired AS (
			UPDATE subscriptions SET status='expired',updated_at=NOW() WHERE status='active' AND ends_at IS NOT NULL AND ends_at <= NOW() AND business_role IS NOT NULL RETURNING user_id,tier
		)
		INSERT INTO notifications(user_id,type,title,body)
		SELECT DISTINCT e.user_id,'subscription_expired','Your plan has ended','Renew your plan to keep publishing. Listings covered by the plan stay visible during the grace period, then they are paused (not deleted).'
		FROM expired e
		WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id=e.user_id AND s.status='active' AND s.starts_at <= NOW() AND s.ends_at > NOW())`); err != nil {
		return err
	}
	grace := s.graceDays(ctx, s.db)
	if _, err := s.db.Exec(ctx, `WITH paused AS (
			UPDATE listings l SET status='paused',paused_reason='plan_expired',updated_at=NOW()
			WHERE l.entitlement_source='plan' AND l.status IN ('published','scheduled') AND l.deleted_at IS NULL
			AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id=l.owner_id AND s.business_role IS NOT NULL AND s.status IN ('active','expired')
				AND (s.starts_at IS NULL OR s.starts_at <= NOW()) AND s.ends_at > NOW() - make_interval(days => $1))
			RETURNING l.owner_id
		)
		INSERT INTO notifications(user_id,type,title,body)
		SELECT DISTINCT owner_id,'listings_paused','Listings paused','Some listings were paused because your plan ended. Renew your plan to publish them again.' FROM paused`, grace); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `WITH current_plan AS (
			SELECT DISTINCT ON (user_id) user_id,
				LEAST(COALESCE((entitlements->>'listing_limit')::int, 2147483647), COALESCE((entitlements->>'fair_use_listing_cap')::int, 500)) AS listing_cap
			FROM subscriptions WHERE status='active' AND business_role IS NOT NULL AND starts_at <= NOW() AND ends_at > NOW()
			ORDER BY user_id, CASE tier WHEN 'platinum' THEN 3 WHEN 'gold' THEN 2 ELSE 1 END DESC
		), ranked AS (
			SELECT l.id, l.owner_id, cp.listing_cap, ROW_NUMBER() OVER (PARTITION BY l.owner_id ORDER BY l.created_at ASC, l.id ASC) AS position
			FROM listings l JOIN current_plan cp ON cp.user_id=l.owner_id
			WHERE l.entitlement_source='plan' AND l.status IN ('published','scheduled') AND l.deleted_at IS NULL
		), paused AS (
			UPDATE listings l SET status='paused',paused_reason='plan_limit',updated_at=NOW() FROM ranked
			WHERE l.id=ranked.id AND ranked.position > ranked.listing_cap RETURNING l.owner_id
		)
		INSERT INTO notifications(user_id,type,title,body)
		SELECT DISTINCT owner_id,'listings_paused','Listings paused','Your current plan allows fewer listings, so your newest listings above the limit were paused. Upgrade or pay per listing to publish them again.' FROM paused`)
	return err
}

// RunScheduledJobs performs time-based maintenance. It is idempotent and safe
// to run from several instances at once.
func (s *Server) RunScheduledJobs(ctx context.Context) {
	if s.db == nil {
		return
	}
	if err := s.publishDueListings(ctx); err != nil {
		log.Printf("scheduled job: publish due listings: %v", err)
	}
	if err := s.expireBusinessSubscriptions(ctx); err != nil {
		log.Printf("scheduled job: expire subscriptions: %v", err)
	}
}

// StartScheduler runs RunScheduledJobs every interval until ctx is cancelled.
func (s *Server) StartScheduler(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		s.RunScheduledJobs(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.RunScheduledJobs(ctx)
			}
		}
	}()
}
