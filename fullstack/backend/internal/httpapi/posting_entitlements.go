package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/mail"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func postingRole(user CurrentUser) string {
	if user.WorkspaceKind == "landlord" {
		return "landlord"
	}
	return user.Role
}

func calculatePostingFee(price, ratePercent, fixedFee float64) float64 {
	return math.Round((price*ratePercent/100+fixedFee)*100) / 100
}

func calculateRolePostingFee(role string, price, ratePercent, fixedFee float64) (float64, float64, error) {
	switch role {
	case "property_owner":
		fee := calculatePostingFee(price, ratePercent, fixedFee)
		if fee <= 0 {
			return 0, 0, fmt.Errorf("configured property-owner posting fee must be greater than zero")
		}
		return ratePercent, fee, nil
	case "landlord":
		if fixedFee <= 0 {
			return 0, 0, fmt.Errorf("no fixed marketplace posting fee is configured for this landlord account")
		}
		return 0, fixedFee, nil
	default:
		return 0, 0, fmt.Errorf("this account publishes using purchased upload slots")
	}
}

func (s *Server) configuredListingFee(ctx context.Context, user CurrentUser, price float64) (float64, float64, error) {
	if price <= 0 || math.IsNaN(price) || math.IsInf(price, 0) {
		return 0, 0, fmt.Errorf("listing price must be greater than zero")
	}
	role := postingRole(user)
	var rate, fixed float64
	err := s.db.QueryRow(ctx, `SELECT rate_percent,fixed_fee FROM marketplace_listing_fee_rules WHERE role=$1 AND enabled AND (($2=0 AND price_min=0 AND price_max IS NOT NULL AND $3<=price_max) OR ($2>price_min AND (price_max IS NULL OR $2<=price_max))) ORDER BY price_min DESC LIMIT 1`, role, price, price).Scan(&rate, &fixed)
	if err != nil {
		return 0, 0, fmt.Errorf("no enabled marketplace posting price is configured for this account")
	}
	return calculateRolePostingFee(role, price, rate, fixed)
}

func (s *Server) configuredLandlordPlanFee(ctx context.Context, plan string) (float64, int, error) {
	plan = strings.ToLower(strings.TrimSpace(plan))
	if plan != "silver" && plan != "gold" && plan != "platinum" {
		return 0, 0, fmt.Errorf("choose a Silver, Gold, or Platinum landlord plan")
	}
	var amount float64
	var duration int
	if err := s.db.QueryRow(ctx, `SELECT price,duration_days FROM marketplace_premium_offers WHERE offer_key=$1 AND enabled`, plan).Scan(&amount, &duration); err != nil || amount <= 0 || duration <= 0 {
		return 0, 0, fmt.Errorf("the selected landlord plan is not configured")
	}
	return amount, duration, nil
}

func (s *Server) listingExpiryDays(ctx context.Context, user CurrentUser) (int, error) {
	var days int
	err := s.db.QueryRow(ctx, `SELECT MAX(default_expiry_days) FROM marketplace_listing_fee_rules WHERE role=$1 AND enabled`, postingRole(user)).Scan(&days)
	if err != nil || days < 1 {
		return 0, fmt.Errorf("no listing expiry policy is configured for this account")
	}
	return days, nil
}

func (s *Server) listingEntitlements(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "komisiyoneri" && user.Role != "property_owner" && user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "marketplace posting access required")
		return
	}
	var purchased, used, remaining, properties int
	err := s.db.QueryRow(r.Context(), `SELECT COUNT(*),COUNT(*) FILTER (WHERE status='consumed'),COUNT(*) FILTER (WHERE status='available') FROM listing_upload_slots WHERE owner_id=$1`, user.ID).Scan(&purchased, &used, &remaining)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load posting entitlements")
		return
	}
	_ = s.db.QueryRow(r.Context(), `SELECT COUNT(DISTINCT l.id) FROM listings l WHERE l.owner_id=$1 AND (EXISTS(SELECT 1 FROM listing_subscriptions ls WHERE ls.listing_id=l.id AND ls.status='active') OR EXISTS(SELECT 1 FROM listing_upload_slots us WHERE us.listing_id=l.id AND us.status='consumed'))`, user.ID).Scan(&properties)
	rows, err := s.db.Query(r.Context(), `SELECT package_key,label,slot_count,price,currency,benefits FROM listing_upload_packages WHERE enabled ORDER BY slot_count`)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load upload packages")
		return
	}
	defer rows.Close()
	packages := make([]map[string]any, 0)
	for rows.Next() {
		var key, label, currency string
		var count int
		var price float64
		var benefits json.RawMessage
		if err := rows.Scan(&key, &label, &count, &price, &currency, &benefits); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not read upload packages")
			return
		}
		packages = append(packages, map[string]any{"key": key, "label": label, "slots": count, "price": price, "currency": currency, "benefits": benefits})
	}
	writeJSON(w, http.StatusOK, map[string]any{"purchased_slots": purchased, "used_slots": used, "remaining_slots": remaining, "properties_posted": properties, "packages": packages})
}

func (s *Server) listingFeeQuote(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if postingRole(user) == "komisiyoneri" {
		var slots int
		if err := s.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM listing_upload_slots WHERE owner_id=$1 AND status='available'`, user.ID).Scan(&slots); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not check upload slots")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"payment_type": "paid_upload_slot", "payment_model": "upload_slot", "available_slots": slots, "currency": "RWF", "demo_mode": false})
		return
	}
	if postingRole(user) == "landlord" {
		fee, days, err := s.configuredLandlordPlanFee(r.Context(), r.URL.Query().Get("plan"))
		if err != nil {
			errorJSON(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"fee": math.Round(fee), "rate_percent": 0, "duration_days": days, "payment_type": "monthly_landlord_plan", "payment_model": "monthly_plan", "currency": "RWF", "demo_mode": s.cfg.DemoPaymentsEnabled})
		return
	}
	price, err := strconv.ParseFloat(strings.TrimSpace(r.URL.Query().Get("price")), 64)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "enter a valid listing price")
		return
	}
	rate, fee, err := s.configuredListingFee(r.Context(), user, price)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	paymentType := "one_time_listing_upload"
	paymentModel := "percentage"
	if postingRole(user) == "landlord" {
		paymentType = "one_time_marketplace_posting_fee"
		paymentModel = "fixed"
	}
	writeJSON(w, http.StatusOK, map[string]any{"price": price, "fee": math.Round(fee), "rate_percent": rate, "currency": "RWF", "payment_type": paymentType, "payment_model": paymentModel, "demo_mode": s.cfg.DemoPaymentsEnabled})
}

func (s *Server) createUploadSlotPurchase(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "komisiyoneri" && user.Role != "property_owner" {
		errorJSON(w, http.StatusForbidden, "marketplace posting access required")
		return
	}
	if user.WorkspaceKind == "landlord" && !user.PropertyOwnerEnabled {
		errorJSON(w, http.StatusForbidden, "activate Property Owner access before marketplace posting")
		return
	}
	var input struct {
		PackageKey     string `json:"package_key"`
		Email          string `json:"email"`
		Method         string `json:"payment_method"`
		IdempotencyKey string `json:"idempotency_key"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	input.PackageKey = strings.TrimSpace(input.PackageKey)
	input.Method = strings.ToLower(strings.TrimSpace(input.Method))
	input.IdempotencyKey = strings.TrimSpace(input.IdempotencyKey)
	if input.Method != "card" && input.Method != "mobilemoneyrwanda" {
		errorJSON(w, http.StatusBadRequest, "choose bank card or Rwanda mobile money")
		return
	}
	if _, err := mail.ParseAddress(strings.TrimSpace(input.Email)); err != nil {
		errorJSON(w, http.StatusBadRequest, "enter a valid email address")
		return
	}
	if input.IdempotencyKey == "" || len(input.IdempotencyKey) > 120 {
		errorJSON(w, http.StatusBadRequest, "an idempotency key is required")
		return
	}
	var slots int
	var amount float64
	err := s.db.QueryRow(r.Context(), `SELECT slot_count,price FROM listing_upload_packages WHERE package_key=$1 AND enabled`, input.PackageKey).Scan(&slots, &amount)
	if err != nil {
		errorJSON(w, http.StatusNotFound, "upload package is unavailable")
		return
	}
	var existingID, existingStatus string
	err = s.db.QueryRow(r.Context(), `SELECT id::text,status FROM listing_upload_purchases WHERE owner_id=$1 AND idempotency_key=$2`, user.ID, input.IdempotencyKey).Scan(&existingID, &existingStatus)
	if err == nil {
		if existingStatus == "active" {
			writeJSON(w, http.StatusOK, map[string]any{"id": existingID, "status": "active"})
			return
		}
		errorJSON(w, http.StatusConflict, "this upload package payment was already started; check payment status before retrying")
		return
	}
	if err != pgx.ErrNoRows {
		errorJSON(w, http.StatusInternalServerError, "could not check previous upload purchase")
		return
	}
	token, err := randomToken()
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create payment reference")
		return
	}
	reference := "UM-SLOTS-" + strings.ToUpper(token[:24])
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start upload purchase")
		return
	}
	defer tx.Rollback(r.Context())
	var paymentID, purchaseID string
	if err = tx.QueryRow(r.Context(), `INSERT INTO payments(user_id,related_type,amount,currency,provider,provider_reference,status,expires_at) VALUES($1,'listing_upload_slots',$2,'RWF','flutterwave',$3,'pending',NOW()+INTERVAL '30 minutes') RETURNING id`, user.ID, amount, reference).Scan(&paymentID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save upload payment")
		return
	}
	if err = tx.QueryRow(r.Context(), `INSERT INTO listing_upload_purchases(owner_id,package_key,slot_count,amount,payment_id,provider_reference,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, user.ID, input.PackageKey, slots, amount, paymentID, reference, input.IdempotencyKey).Scan(&purchaseID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save upload purchase")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start upload purchase")
		return
	}
	callbackURL := s.cfg.BackendPublicURL + "/api/v1/listing-upload-payments/verify"
	checkout, err := newFlutterwaveClient(s.cfg.FlutterwaveSecretKey).startCheckout(r.Context(), reference, strings.TrimSpace(input.Email), user.Name, callbackURL, input.Method, "", amount, purchaseID)
	if err != nil {
		_, _ = s.db.Exec(r.Context(), `UPDATE payments SET status='failed' WHERE id=$1 AND status='pending'`, paymentID)
		_, _ = s.db.Exec(r.Context(), `UPDATE listing_upload_purchases SET status='failed' WHERE id=$1 AND status='pending'`, purchaseID)
		errorJSON(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": purchaseID, "checkout_url": checkout, "amount": amount, "currency": "RWF", "slots": slots, "status": "pending"})
}

func (s *Server) verifyUploadSlotPurchase(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "use GET for payment return")
		return
	}
	q := r.URL.Query()
	ref := strings.TrimSpace(q.Get("tx_ref"))
	transactionID := strings.TrimSpace(q.Get("transaction_id"))
	state := "failed"
	var purchaseID, ownerID, packageKey, purchaseStatus string
	_ = s.db.QueryRow(r.Context(), `SELECT id::text,owner_id::text,package_key,status FROM listing_upload_purchases WHERE provider_reference=$1`, ref).Scan(&purchaseID, &ownerID, &packageKey, &purchaseStatus)
	if purchaseStatus == "active" {
		state = "successful"
	}
	if ref != "" && strings.EqualFold(q.Get("status"), "cancelled") {
		_, _ = s.db.Exec(r.Context(), `UPDATE payments SET status='cancelled' WHERE provider='flutterwave' AND provider_reference=$1 AND status='pending'`, ref)
		_, _ = s.db.Exec(r.Context(), `UPDATE listing_upload_purchases SET status='cancelled' WHERE provider_reference=$1 AND status='pending'`, ref)
		state = "cancelled"
	}
	if ref != "" && transactionID != "" && (strings.EqualFold(q.Get("status"), "successful") || strings.EqualFold(q.Get("status"), "pending")) {
		verified, err := newFlutterwaveClient(s.cfg.FlutterwaveSecretKey).verify(r.Context(), transactionID)
		if err == nil && verified.TxRef == ref && verified.Currency == "RWF" {
			tx, txErr := s.db.Begin(r.Context())
			if txErr == nil {
				var storedPayment string
				var amount float64
				var pstatus string
				txErr = tx.QueryRow(r.Context(), `SELECT p.id::text,p.amount,p.status FROM payments p JOIN listing_upload_purchases u ON u.payment_id=p.id WHERE u.id=$1 FOR UPDATE OF p,u`, purchaseID).Scan(&storedPayment, &amount, &pstatus)
				if txErr == nil && math.Abs(verified.Amount-amount) < 0.01 && pstatus == "pending" && strings.EqualFold(verified.Status, "successful") {
					_, txErr = tx.Exec(r.Context(), `UPDATE payments SET status='successful',provider_transaction_id=$2 WHERE id=$1 AND status='pending'`, storedPayment, fmt.Sprint(verified.ID))
					if txErr == nil {
						_, txErr = tx.Exec(r.Context(), `UPDATE listing_upload_purchases SET status='active',provider_transaction_id=$2,verified_at=NOW() WHERE id=$1 AND status='pending'`, purchaseID, fmt.Sprint(verified.ID))
					}
					if txErr == nil {
						_, txErr = tx.Exec(r.Context(), `INSERT INTO listing_upload_slots(purchase_id,owner_id) SELECT $1,$2 FROM generate_series(1,(SELECT slot_count FROM listing_upload_purchases WHERE id=$1)) ON CONFLICT DO NOTHING`, purchaseID, ownerID)
					}
					if txErr == nil {
						txErr = tx.Commit(r.Context())
						state = "successful"
					}
				} else if txErr == nil && math.Abs(verified.Amount-amount) < 0.01 && pstatus == "pending" && strings.EqualFold(verified.Status, "pending") {
					_, txErr = tx.Exec(r.Context(), `UPDATE payments SET provider_transaction_id=$2 WHERE id=$1 AND status='pending'`, storedPayment, fmt.Sprint(verified.ID))
					if txErr == nil {
						txErr = tx.Commit(r.Context())
						state = "pending"
					}
				} else if txErr == nil && math.Abs(verified.Amount-amount) < 0.01 && pstatus == "pending" && (strings.EqualFold(verified.Status, "failed") || strings.EqualFold(verified.Status, "cancelled")) {
					finalStatus := "failed"
					if strings.EqualFold(verified.Status, "cancelled") {
						finalStatus = "cancelled"
					}
					_, txErr = tx.Exec(r.Context(), `UPDATE payments SET status=$2 WHERE id=$1 AND status='pending'`, storedPayment, finalStatus)
					if txErr == nil {
						_, txErr = tx.Exec(r.Context(), `UPDATE listing_upload_purchases SET status=$2 WHERE id=$1 AND status='pending'`, purchaseID, finalStatus)
					}
					if txErr == nil {
						txErr = tx.Commit(r.Context())
						state = finalStatus
					}
				}
				if txErr != nil {
					_ = tx.Rollback(r.Context())
				} else if state != "successful" {
					_ = tx.Commit(r.Context())
				}
			}
		}
	}
	returnURL := s.cfg.FrontendBaseURL + "/listing-payment?status=" + url.QueryEscape(state) + "&purchase_id=" + url.QueryEscape(purchaseID)
	returnURL += "&package_key=" + url.QueryEscape(packageKey)
	if state == "pending" {
		returnURL += "&tx_ref=" + url.QueryEscape(ref) + "&transaction_id=" + url.QueryEscape(transactionID)
	}
	http.Redirect(w, r, returnURL, http.StatusSeeOther)
}

func (s *Server) publishListingWithEntitlement(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "komisiyoneri" && user.Role != "property_owner" && user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "marketplace posting access required")
		return
	}
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use POST to publish a listing")
		return
	}
	var input struct {
		RequestedStatus string     `json:"requested_status"`
		PublishAt       *time.Time `json:"publish_at"`
	}
	if r.ContentLength > 0 && !decodeJSON(w, r, &input) {
		return
	}
	if input.RequestedStatus == "" {
		input.RequestedStatus = "published"
	}
	if input.RequestedStatus != "published" && input.RequestedStatus != "scheduled" {
		errorJSON(w, http.StatusBadRequest, "requested_status must be published or scheduled")
		return
	}
	startAt := time.Now().UTC()
	if input.RequestedStatus == "scheduled" {
		if input.PublishAt == nil || !input.PublishAt.After(startAt) {
			errorJSON(w, http.StatusBadRequest, "choose a future publish date")
			return
		}
		startAt = input.PublishAt.UTC()
	}
	expiryDays, err := s.listingExpiryDays(r.Context(), user)
	if err != nil {
		errorJSON(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start publication")
		return
	}
	defer tx.Rollback(r.Context())
	var status string
	var deletedAt *time.Time
	err = tx.QueryRow(r.Context(), `SELECT status,deleted_at FROM listings WHERE id=$1 AND owner_id=$2 FOR UPDATE`, id, user.ID).Scan(&status, &deletedAt)
	if err != nil || deletedAt != nil {
		errorJSON(w, http.StatusConflict, "only an active saved draft can be published")
		return
	}
	if user.Role == "property_owner" {
		var paid bool
		if err := tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM listing_subscriptions WHERE listing_id=$1 AND owner_id=$2 AND status='active')`, id, user.ID).Scan(&paid); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not verify the listing payment")
			return
		}
		if !paid {
			errorJSON(w, http.StatusPaymentRequired, "complete the one-time listing payment before publishing")
			return
		}
		if status == input.RequestedStatus {
			writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": input.RequestedStatus, "entitlement": "subscription"})
			return
		}
		if status != "draft" {
			errorJSON(w, http.StatusConflict, "only an active saved draft can be published")
			return
		}
		expiresAt := startAt.Add(time.Duration(expiryDays) * 24 * time.Hour)
		result, err := tx.Exec(r.Context(), `UPDATE listings SET status=$3,publish_at=$4,expires_at=$5,updated_at=NOW() WHERE id=$1 AND owner_id=$2 AND status='draft' AND deleted_at IS NULL`, id, user.ID, input.RequestedStatus, startAt, expiresAt)
		if err != nil {
			log.Printf("paid listing publish update failed for listing %s: %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "could not publish the paid draft")
			return
		}
		if result.RowsAffected() != 1 {
			log.Printf("paid listing publish updated %d rows for listing %s", result.RowsAffected(), id)
			errorJSON(w, http.StatusInternalServerError, "could not publish the paid draft")
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			log.Printf("paid listing publish commit failed for listing %s: %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "could not publish the paid draft")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": input.RequestedStatus, "entitlement": "subscription"})
		return
	}
	var slotID string
	err = tx.QueryRow(r.Context(), `SELECT id FROM listing_upload_slots WHERE owner_id=$1 AND status='available' ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`, user.ID).Scan(&slotID)
	if err == pgx.ErrNoRows {
		errorJSON(w, http.StatusPaymentRequired, "payment required before this listing can be published")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not verify upload entitlement")
		return
	}
	result, err := tx.Exec(r.Context(), `UPDATE listing_upload_slots SET status='consumed',listing_id=$2,consumed_at=NOW() WHERE id=$1 AND status='available'`, slotID, id)
	if err != nil || result.RowsAffected() != 1 {
		errorJSON(w, http.StatusConflict, "upload slot was already used")
		return
	}
	expiresAt := startAt.Add(time.Duration(expiryDays) * 24 * time.Hour)
	if _, err = tx.Exec(r.Context(), `UPDATE listings SET status=$3,publish_at=$4,expires_at=$5,updated_at=NOW() WHERE id=$1 AND owner_id=$2 AND status='draft' AND deleted_at IS NULL`, id, user.ID, input.RequestedStatus, startAt, expiresAt); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not publish listing")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not publish listing")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": input.RequestedStatus, "entitlement": "upload_slot"})
}

func (s *Server) adminMarketplacePricing(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "admin access required")
		return
	}
	if r.Method == http.MethodGet {
		fees, err := s.db.Query(r.Context(), `SELECT role,price_min,price_max,rate_percent,fixed_fee,default_expiry_days,enabled FROM marketplace_listing_fee_rules ORDER BY role,price_min`)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not load fee rules")
			return
		}
		defer fees.Close()
		feeRows := make([]map[string]any, 0)
		for fees.Next() {
			var role string
			var min, rate, fixed float64
			var max *float64
			var expiryDays int
			var enabled bool
			if fees.Scan(&role, &min, &max, &rate, &fixed, &expiryDays, &enabled) != nil {
				errorJSON(w, http.StatusInternalServerError, "could not read fee rules")
				return
			}
			feeRows = append(feeRows, map[string]any{"role": role, "price_min": min, "price_max": max, "rate_percent": rate, "fixed_fee": fixed, "expiry_days": expiryDays, "enabled": enabled})
		}
		packages, err := s.db.Query(r.Context(), `SELECT package_key,label,slot_count,price,benefits,enabled FROM listing_upload_packages ORDER BY slot_count`)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not load upload packages")
			return
		}
		defer packages.Close()
		packageRows := make([]map[string]any, 0)
		for packages.Next() {
			var key, label string
			var slots int
			var price float64
			var benefits json.RawMessage
			var enabled bool
			if packages.Scan(&key, &label, &slots, &price, &benefits, &enabled) != nil {
				errorJSON(w, http.StatusInternalServerError, "could not read upload packages")
				return
			}
			packageRows = append(packageRows, map[string]any{"key": key, "label": label, "slots": slots, "price": price, "benefits": benefits, "enabled": enabled})
		}
		payments, err := s.db.Query(r.Context(), `SELECT id::text,user_id::text,related_type,COALESCE(related_id::text,''),amount,currency,provider,status,COALESCE(provider_reference,''),created_at FROM payments WHERE related_type IN ('listing_subscription','listing_upload_slots','owner_upgrade') ORDER BY created_at DESC LIMIT 200`)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not load payment history")
			return
		}
		defer payments.Close()
		paymentRows := make([]map[string]any, 0)
		for payments.Next() {
			var id, ownerID, kind, relatedID, currency, provider, status, reference string
			var amount float64
			var created time.Time
			if payments.Scan(&id, &ownerID, &kind, &relatedID, &amount, &currency, &provider, &status, &reference, &created) != nil {
				errorJSON(w, http.StatusInternalServerError, "could not read payment history")
				return
			}
			paymentRows = append(paymentRows, map[string]any{"id": id, "owner_id": ownerID, "related_type": kind, "related_id": relatedID, "amount": amount, "currency": currency, "provider": provider, "status": status, "reference": reference, "created_at": created})
		}
		premiumRows := make([]map[string]any, 0)
		premium, err := s.db.Query(r.Context(), `SELECT offer_key,label,price,duration_days,benefits,enabled FROM marketplace_premium_offers ORDER BY price`)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not load premium offers")
			return
		}
		defer premium.Close()
		for premium.Next() {
			var key, label string
			var price float64
			var days int
			var benefits json.RawMessage
			var enabled bool
			if premium.Scan(&key, &label, &price, &days, &benefits, &enabled) != nil {
				errorJSON(w, http.StatusInternalServerError, "could not read premium offers")
				return
			}
			premiumRows = append(premiumRows, map[string]any{"key": key, "label": label, "price": price, "duration_days": days, "benefits": benefits, "enabled": enabled})
		}
		writeJSON(w, http.StatusOK, map[string]any{"fees": feeRows, "packages": packageRows, "premium_offers": premiumRows, "payments": paymentRows})
		return
	}
	if r.Method != http.MethodPatch {
		errorJSON(w, http.StatusMethodNotAllowed, "use GET or PATCH")
		return
	}
	var input struct {
		Fees []struct {
			Role       string   `json:"role"`
			Min        float64  `json:"price_min"`
			Max        *float64 `json:"price_max"`
			Rate       float64  `json:"rate_percent"`
			Fixed      float64  `json:"fixed_fee"`
			ExpiryDays int      `json:"expiry_days"`
			Enabled    bool     `json:"enabled"`
		} `json:"fees"`
		Packages []struct {
			Key      string   `json:"key"`
			Label    string   `json:"label"`
			Slots    int      `json:"slots"`
			Price    float64  `json:"price"`
			Benefits []string `json:"benefits"`
			Enabled  bool     `json:"enabled"`
		} `json:"packages"`
		PremiumOffers []struct {
			Key          string   `json:"key"`
			Label        string   `json:"label"`
			Price        float64  `json:"price"`
			DurationDays int      `json:"duration_days"`
			Benefits     []string `json:"benefits"`
			Enabled      bool     `json:"enabled"`
		} `json:"premium_offers"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save pricing")
		return
	}
	defer tx.Rollback(r.Context())
	for _, rule := range input.Fees {
		if (rule.Role != "komisiyoneri" && rule.Role != "property_owner" && rule.Role != "landlord") || rule.Min < 0 || rule.Rate < 0 || rule.Fixed < 0 || rule.ExpiryDays < 1 || (rule.Max != nil && *rule.Max <= rule.Min) {
			errorJSON(w, http.StatusBadRequest, "invalid fee rule")
			return
		}
		if _, err = tx.Exec(r.Context(), `INSERT INTO marketplace_listing_fee_rules(role,price_min,price_max,rate_percent,fixed_fee,default_expiry_days,enabled,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,NOW()) ON CONFLICT(role,price_min) DO UPDATE SET price_max=EXCLUDED.price_max,rate_percent=EXCLUDED.rate_percent,fixed_fee=EXCLUDED.fixed_fee,default_expiry_days=EXCLUDED.default_expiry_days,enabled=EXCLUDED.enabled,updated_at=NOW()`, rule.Role, rule.Min, rule.Max, rule.Rate, rule.Fixed, rule.ExpiryDays, rule.Enabled); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not save fee rule")
			return
		}
	}
	for _, pkg := range input.Packages {
		if pkg.Key == "" || pkg.Label == "" || pkg.Slots < 1 || pkg.Price <= 0 {
			errorJSON(w, http.StatusBadRequest, "upload packages require a label, positive price, and at least one slot")
			return
		}
		benefits, _ := json.Marshal(pkg.Benefits)
		if _, err = tx.Exec(r.Context(), `INSERT INTO listing_upload_packages(package_key,label,slot_count,price,benefits,enabled,updated_at) VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(package_key) DO UPDATE SET label=EXCLUDED.label,slot_count=EXCLUDED.slot_count,price=EXCLUDED.price,benefits=EXCLUDED.benefits,enabled=EXCLUDED.enabled,updated_at=NOW()`, pkg.Key, pkg.Label, pkg.Slots, pkg.Price, benefits, pkg.Enabled); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not save upload package")
			return
		}
	}
	for _, offer := range input.PremiumOffers {
		if (offer.Key != "silver" && offer.Key != "gold" && offer.Key != "platinum" && offer.Key != "diamond") || offer.Label == "" || offer.Price <= 0 || offer.DurationDays < 0 {
			errorJSON(w, http.StatusBadRequest, "invalid premium offer")
			return
		}
		benefits, _ := json.Marshal(offer.Benefits)
		if _, err = tx.Exec(r.Context(), `INSERT INTO marketplace_premium_offers(offer_key,label,price,duration_days,benefits,enabled,updated_at) VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(offer_key) DO UPDATE SET label=EXCLUDED.label,price=EXCLUDED.price,duration_days=EXCLUDED.duration_days,benefits=EXCLUDED.benefits,enabled=EXCLUDED.enabled,updated_at=NOW()`, offer.Key, offer.Label, offer.Price, offer.DurationDays, benefits, offer.Enabled); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not save premium offer")
			return
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save pricing")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}
