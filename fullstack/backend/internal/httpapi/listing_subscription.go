package httpapi

import (
	"fmt"
	"log"
	"math"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"
)

// demoListingPayment completes a visibly marked, development-only checkout.
func (s *Server) demoListingPayment(w http.ResponseWriter, r *http.Request, listingID string) {
	if !s.cfg.DemoPaymentsEnabled {
		errorJSON(w, http.StatusNotFound, "demo payments are disabled")
		return
	}
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use POST to complete the demo payment")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "sign in to continue")
		return
	}
	if user.Role != "property_owner" && user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "marketplace posting access required")
		return
	}
	if postingRole(user) == "komisiyoneri" {
		errorJSON(w, http.StatusForbidden, "Komisiyoneri publishing uses purchased upload slots")
		return
	}
	if user.WorkspaceKind == "landlord" && !user.PropertyOwnerEnabled {
		errorJSON(w, http.StatusForbidden, "activate Property Owner access before posting")
		return
	}
	var input struct {
		Email          string     `json:"email"`
		Phone          string     `json:"phone"`
		RequestedState string     `json:"requested_status"`
		PublishAt      *time.Time `json:"publish_at"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if strings.TrimSpace(input.Email) == "" {
		if _, err := normalizeRwandaPhone(input.Phone); err != nil {
			errorJSON(w, http.StatusBadRequest, "enter an email address or a valid Rwanda phone number")
			return
		}
	} else if _, err := mail.ParseAddress(strings.TrimSpace(input.Email)); err != nil {
		errorJSON(w, http.StatusBadRequest, "enter a valid email address or leave it blank and enter a phone number")
		return
	}
	if input.RequestedState != "published" && input.RequestedState != "scheduled" && input.RequestedState != "draft" {
		errorJSON(w, http.StatusBadRequest, "choose whether to save a paid draft or publish the listing")
		return
	}
	if user.Role == "property_owner" {
		var verified bool
		if err := s.db.QueryRow(r.Context(), `SELECT phone_verified_at IS NOT NULL FROM users WHERE id=$1`, user.ID).Scan(&verified); err != nil || !verified {
			errorJSON(w, http.StatusForbidden, "verify your phone number with OTP before posting")
			return
		}
	}
	var currency, status string
	var price float64
	if err := s.db.QueryRow(r.Context(), `SELECT price,currency,status FROM listings WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL`, listingID, user.ID).Scan(&price, &currency, &status); err != nil {
		errorJSON(w, http.StatusNotFound, "listing not found")
		return
	}
	if status != "draft" || currency != "RWF" {
		errorJSON(w, http.StatusConflict, "only an active RWF draft can use demo checkout")
		return
	}
	rate, fee, err := s.configuredListingFee(r.Context(), user, price)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	if input.RequestedState == "scheduled" && (input.PublishAt == nil || !input.PublishAt.After(time.Now())) {
		errorJSON(w, http.StatusBadRequest, "choose a future publish date")
		return
	}
	var activePayment, activeDemoPayment bool
	if err := s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM listing_subscriptions WHERE listing_id=$1 AND owner_id=$2 AND status='active'), EXISTS(SELECT 1 FROM listing_subscriptions ls JOIN payments p ON p.id=ls.payment_id WHERE ls.listing_id=$1 AND ls.owner_id=$2 AND ls.status='active' AND p.provider='demo')`, listingID, user.ID).Scan(&activePayment, &activeDemoPayment); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not verify the listing payment")
		return
	}
	if activePayment {
		writeJSON(w, http.StatusOK, map[string]any{"status": "successful", "provider": "demo", "is_demo": activeDemoPayment, "amount": math.Round(fee), "currency": "RWF", "listing_id": listingID, "message": "A confirmed listing payment already exists."})
		return
	}
	token, err := randomToken()
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create demo payment reference")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start demo checkout")
		return
	}
	defer tx.Rollback(r.Context())
	var paymentID string
	txRef := "UM-DEMO-LISTING-" + strings.ToUpper(token[:20])
	if err := tx.QueryRow(r.Context(), `INSERT INTO payments(user_id,related_type,related_id,amount,currency,provider,provider_reference,status,expires_at) VALUES($1,'listing_subscription',$2,$3,'RWF','demo',$4,'pending',NOW()+INTERVAL '10 minutes') RETURNING id`, user.ID, listingID, math.Round(fee), txRef).Scan(&paymentID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create demo payment record")
		return
	}
	if _, err := tx.Exec(r.Context(), `INSERT INTO listing_subscriptions(listing_id,owner_id,payment_id,monthly_amount,rate_percent,status,requested_status,publish_at) VALUES($1,$2,$3,$4,$5,'pending',$6,$7)`, listingID, user.ID, paymentID, math.Round(fee), rate, input.RequestedState, input.PublishAt); err != nil {
		errorJSON(w, http.StatusConflict, "a payment is already in progress for this listing")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not record demo payment")
		return
	}
	if err := s.activateListingSubscription(r, paymentID, listingID, txRef); err != nil {
		log.Printf("demo listing payment activation failed for listing %s: %v", listingID, err)
		_, _ = s.db.Exec(r.Context(), `UPDATE payments SET status='failed' WHERE id=$1 AND status='pending'`, paymentID)
		_, _ = s.db.Exec(r.Context(), `UPDATE listing_subscriptions SET status='failed' WHERE payment_id=$1 AND status='pending'`, paymentID)
		errorJSON(w, http.StatusConflict, "demo payment could not complete this listing")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "successful", "provider": "demo", "is_demo": true, "amount": math.Round(fee), "currency": "RWF", "listing_id": listingID, "message": "Demo payment successful. This is not a real charge."})
}

func (s *Server) startListingSubscriptionPayment(w http.ResponseWriter, r *http.Request, listingID string) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "sign in to pay the one-time listing upload fee")
		return
	}
	if user.Role != "property_owner" && user.Role != "komisiyoneri" && user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "only a property owner or Komisiyoneri can pay for a listing")
		return
	}
	if user.WorkspaceKind == "landlord" && !user.PropertyOwnerEnabled {
		errorJSON(w, http.StatusForbidden, "activate Property Owner access before paying to publish")
		return
	}
	if postingRole(user) == "komisiyoneri" {
		errorJSON(w, http.StatusForbidden, "Komisiyoneri publishing uses purchased upload slots; buy an upload package to continue")
		return
	}
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use POST to start listing payment")
		return
	}
	var input struct {
		Method         string     `json:"payment_method"`
		Email          string     `json:"email"`
		Phone          string     `json:"phone"`
		RequestedState string     `json:"requested_status"`
		PublishAt      *time.Time `json:"publish_at"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	input.Method = strings.ToLower(strings.TrimSpace(input.Method))
	if input.Method != "card" && input.Method != "mobilemoneyrwanda" {
		errorJSON(w, http.StatusBadRequest, "choose bank card or Rwanda mobile money")
		return
	}
	if input.Method == "card" {
		if _, err := mail.ParseAddress(strings.TrimSpace(input.Email)); err != nil {
			errorJSON(w, http.StatusBadRequest, "enter a valid email address for bank card checkout")
			return
		}
	}
	phone := ""
	if input.Method == "mobilemoneyrwanda" {
		normalizedPhone, phoneErr := normalizeRwandaPhone(input.Phone)
		if phoneErr != nil {
			errorJSON(w, http.StatusBadRequest, "enter a valid Rwanda phone number for mobile money")
			return
		}
		phone = normalizedPhone
		if strings.TrimSpace(input.Email) == "" {
			input.Email = strings.TrimSpace(user.Email)
			if _, err := mail.ParseAddress(input.Email); err != nil {
				errorJSON(w, http.StatusBadRequest, "add an email to your account or enter an email in checkout for the payment receipt")
				return
			}
		} else if _, err := mail.ParseAddress(strings.TrimSpace(input.Email)); err != nil {
			errorJSON(w, http.StatusBadRequest, "enter a valid email address or leave it blank and use your account email")
			return
		}
	}
	if input.RequestedState != "published" && input.RequestedState != "scheduled" && input.RequestedState != "draft" {
		errorJSON(w, http.StatusBadRequest, "listing must be saved as a paid draft, published, or scheduled after payment")
		return
	}
	var currency string
	var price float64
	var status string
	if user.Role == "property_owner" {
		var verified bool
		if err := s.db.QueryRow(r.Context(), `SELECT phone_verified_at IS NOT NULL FROM users WHERE id=$1`, user.ID).Scan(&verified); err != nil || !verified {
			errorJSON(w, http.StatusForbidden, "verify your phone number with OTP before paying to publish")
			return
		}
	}
	if err := s.db.QueryRow(r.Context(), `SELECT price,currency,status FROM listings WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL`, listingID, user.ID).Scan(&price, &currency, &status); err != nil {
		errorJSON(w, http.StatusNotFound, "listing not found")
		return
	}
	if status != "draft" {
		errorJSON(w, http.StatusConflict, "only a saved draft can start its first listing payment")
		return
	}
	rate, fee, feeErr := s.configuredListingFee(r.Context(), user, price)
	if feeErr != nil || math.Round(fee) < 1 || currency != "RWF" {
		errorJSON(w, http.StatusConflict, "listing price or one-time upload fee is not valid")
		return
	}
	if input.RequestedState == "scheduled" && (input.PublishAt == nil || !input.PublishAt.After(time.Now())) {
		errorJSON(w, http.StatusBadRequest, "choose a future publish date")
		return
	}
	_, _ = s.db.Exec(r.Context(), `UPDATE payments SET status='expired' WHERE related_type='listing_subscription' AND related_id=$1 AND status='pending' AND expires_at <= NOW()`, listingID)
	_, _ = s.db.Exec(r.Context(), `UPDATE listing_subscriptions SET status='failed' WHERE listing_id=$1 AND status='pending' AND payment_id IN (SELECT id FROM payments WHERE status='expired')`, listingID)
	var pendingExists bool
	if err := s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM payments WHERE related_type='listing_subscription' AND related_id=$1 AND status='pending' AND expires_at > NOW())`, listingID).Scan(&pendingExists); err == nil && pendingExists {
		errorJSON(w, http.StatusConflict, "a listing payment is already in progress. Finish that checkout or wait for it to expire before starting another")
		return
	}
	token, err := randomToken()
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create payment reference")
		return
	}
	txRef := "UM-LISTING-" + strings.ToUpper(token[:24])
	amount := math.Round(fee)
	var paymentID string
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start listing payment")
		return
	}
	defer tx.Rollback(r.Context())
	err = tx.QueryRow(r.Context(), `INSERT INTO payments(user_id,related_type,related_id,amount,currency,provider,provider_reference,status,expires_at) VALUES($1,'listing_subscription',$2,$3,'RWF','flutterwave',$4,'pending',NOW()+INTERVAL '30 minutes') RETURNING id`, user.ID, listingID, amount, txRef).Scan(&paymentID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save payment request")
		return
	}
	_, err = tx.Exec(r.Context(), `INSERT INTO listing_subscriptions(listing_id,owner_id,payment_id,monthly_amount,rate_percent,status,requested_status,publish_at) VALUES($1,$2,$3,$4,$5,'pending',$6,$7)`, listingID, user.ID, paymentID, amount, rate, input.RequestedState, input.PublishAt)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save listing payment")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start listing payment")
		return
	}
	redirectURL := s.cfg.BackendPublicURL + "/api/v1/listing-subscription-payments/verify"
	checkoutURL, err := newFlutterwaveClient(s.cfg.FlutterwaveSecretKey).startCheckout(r.Context(), txRef, strings.TrimSpace(input.Email), user.Name, redirectURL, input.Method, phone, amount, listingID)
	if err != nil {
		_, _ = s.db.Exec(r.Context(), `UPDATE payments SET status='failed' WHERE id=$1 AND status='pending'`, paymentID)
		_, _ = s.db.Exec(r.Context(), `UPDATE listing_subscriptions SET status='failed' WHERE payment_id=$1 AND status='pending'`, paymentID)
		errorJSON(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": paymentID, "checkout_url": checkoutURL, "amount": amount, "currency": "RWF", "provider": "flutterwave", "status": "pending"})
}

func (s *Server) verifyListingSubscriptionPayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "use GET for the payment return")
		return
	}
	query := r.URL.Query()
	txRef := strings.TrimSpace(query.Get("tx_ref"))
	transactionID := strings.TrimSpace(query.Get("transaction_id"))
	statusParam := strings.ToLower(strings.TrimSpace(query.Get("status")))
	resultStatus := "failed"
	listingID := ""
	paidDraft := false
	if txRef != "" {
		_ = s.db.QueryRow(r.Context(), `SELECT related_id::text FROM payments WHERE provider='flutterwave' AND provider_reference=$1 AND related_type='listing_subscription'`, txRef).Scan(&listingID)
		_ = s.db.QueryRow(r.Context(), `SELECT ls.requested_status='draft' FROM listing_subscriptions ls JOIN payments p ON p.id=ls.payment_id WHERE p.provider='flutterwave' AND p.provider_reference=$1`, txRef).Scan(&paidDraft)
	}
	if txRef != "" && transactionID != "" && (statusParam == "successful" || statusParam == "pending") {
		verified, err := newFlutterwaveClient(s.cfg.FlutterwaveSecretKey).verify(r.Context(), transactionID)
		if err == nil && verified.TxRef == txRef && verified.Currency == "RWF" {
			var paymentID, storedListingID, paymentStatus string
			var amount float64
			if err := s.db.QueryRow(r.Context(), `SELECT p.id::text,p.related_id::text,p.amount,p.status FROM payments p JOIN listing_subscriptions ls ON ls.payment_id=p.id WHERE p.provider='flutterwave' AND p.provider_reference=$1 AND p.related_type='listing_subscription'`, txRef).Scan(&paymentID, &storedListingID, &amount, &paymentStatus); err == nil && math.Abs(verified.Amount-amount) < 0.01 {
				if strings.EqualFold(verified.Status, "successful") && paymentStatus == "successful" {
					var active bool
					_ = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM listing_subscriptions WHERE payment_id=$1 AND status='active')`, paymentID).Scan(&active)
					if active {
						resultStatus = "successful"
						_ = s.db.QueryRow(r.Context(), `SELECT requested_status='draft' FROM listing_subscriptions WHERE payment_id=$1`, paymentID).Scan(&paidDraft)
					}
				} else if strings.EqualFold(verified.Status, "successful") && paymentStatus == "pending" && s.activateListingSubscription(r, paymentID, storedListingID, fmt.Sprint(verified.ID)) == nil {
					resultStatus = "successful"
					_ = s.db.QueryRow(r.Context(), `SELECT requested_status='draft' FROM listing_subscriptions WHERE payment_id=$1`, paymentID).Scan(&paidDraft)
				} else if strings.EqualFold(verified.Status, "pending") && paymentStatus == "pending" {
					resultStatus = "pending"
					_, _ = s.db.Exec(r.Context(), `UPDATE payments SET provider_transaction_id=$2 WHERE id=$1 AND status='pending'`, paymentID, fmt.Sprint(verified.ID))
				}
			}
		}
	}
	if resultStatus == "failed" && txRef != "" {
		_, _ = s.db.Exec(r.Context(), `UPDATE payments SET status='failed' WHERE provider='flutterwave' AND provider_reference=$1 AND status='pending'`, txRef)
		_, _ = s.db.Exec(r.Context(), `UPDATE listing_subscriptions SET status='failed' WHERE payment_id IN (SELECT id FROM payments WHERE provider='flutterwave' AND provider_reference=$1) AND status='pending'`, txRef)
	}
	returnURL := s.cfg.FrontendBaseURL + "/listing-payment?status=" + url.QueryEscape(resultStatus) + "&listing_id=" + url.QueryEscape(listingID)
	if paidDraft {
		returnURL += "&paid_draft=1"
	}
	if resultStatus == "pending" {
		returnURL += "&tx_ref=" + url.QueryEscape(txRef) + "&transaction_id=" + url.QueryEscape(transactionID)
	}
	http.Redirect(w, r, returnURL, http.StatusSeeOther)
}

func (s *Server) activateListingSubscription(r *http.Request, paymentID, listingID, providerTransactionID string) error {
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(r.Context())
	var listingStatus string
	var deletedAt *time.Time
	if err := tx.QueryRow(r.Context(), `SELECT status,deleted_at FROM listings WHERE id=$1 FOR UPDATE`, listingID).Scan(&listingStatus, &deletedAt); err != nil {
		return err
	}
	if deletedAt != nil || listingStatus != "draft" {
		return fmt.Errorf("deleted or inactive listings cannot be published")
	}
	var requestedStatus string
	var publishAt *time.Time
	if err := tx.QueryRow(r.Context(), `SELECT requested_status,publish_at FROM listing_subscriptions WHERE payment_id=$1 AND listing_id=$2 AND status='pending' FOR UPDATE`, paymentID, listingID).Scan(&requestedStatus, &publishAt); err != nil {
		return err
	}
	start := time.Now().UTC()
	if requestedStatus == "scheduled" && publishAt != nil && publishAt.After(start) {
		start = publishAt.UTC()
	} else if requestedStatus != "draft" {
		requestedStatus = "published"
		publishAt = nil
	}
	var owner CurrentUser
	if err := tx.QueryRow(r.Context(), `SELECT u.id,u.name,COALESCE(u.email,''),COALESCE(u.phone,''),u.role,u.status,u.workspace_kind,u.property_owner_enabled FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=$1`, listingID).Scan(&owner.ID, &owner.Name, &owner.Email, &owner.Phone, &owner.Role, &owner.Status, &owner.WorkspaceKind, &owner.PropertyOwnerEnabled); err != nil {
		return err
	}
	if postingRole(owner) == "komisiyoneri" {
		return fmt.Errorf("Komisiyoneri listings must use purchased upload slots")
	}
	var expiryDays int
	if err := tx.QueryRow(r.Context(), `SELECT MAX(default_expiry_days) FROM marketplace_listing_fee_rules WHERE role=$1 AND enabled`, postingRole(owner)).Scan(&expiryDays); err != nil || expiryDays < 1 {
		return fmt.Errorf("no listing expiry policy is configured for this account")
	}
	expiresAt := start.Add(time.Duration(expiryDays) * 24 * time.Hour)
	if _, err := tx.Exec(r.Context(), `UPDATE payments SET status='successful',provider_transaction_id=$2 WHERE id=$1 AND status='pending'`, paymentID, providerTransactionID); err != nil {
		return err
	}
	if _, err := tx.Exec(r.Context(), `UPDATE listing_subscriptions SET status='active',period_start=$2,period_end=NULL WHERE payment_id=$1`, paymentID, start); err != nil {
		return err
	}
	result, err := tx.Exec(r.Context(), `UPDATE listings SET status=$2,publish_at=$3,expires_at=$4,updated_at=NOW() WHERE id=$1 AND status='draft' AND deleted_at IS NULL`, listingID, requestedStatus, publishAt, expiresAt)
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return fmt.Errorf("listing draft could not be activated")
	}
	return tx.Commit(r.Context())
}

func (s *Server) listingSubscriptionRoute(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/api/v1/listing-subscription-payments/verify" {
		s.verifyListingSubscriptionPayment(w, r)
		return
	}
	const suffix = "/subscription-payment"
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/listings/"), "/")
	if !strings.HasSuffix(path, suffix) {
		errorJSON(w, http.StatusNotFound, "listing payment route not found")
		return
	}
	listingID := strings.TrimSuffix(path, suffix)
	s.listingPayRoute(w, r, listingID)
}

func (s *Server) listingPayRoute(w http.ResponseWriter, r *http.Request, listingID string) {
	if listingID == "" || strings.Contains(listingID, "/") {
		errorJSON(w, http.StatusNotFound, "listing payment route not found")
		return
	}
	s.startListingSubscriptionPayment(w, r, listingID)
}
