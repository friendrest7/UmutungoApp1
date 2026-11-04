package httpapi

import (
	"fmt"
	"math"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"
)

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
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use POST to start listing payment")
		return
	}
	var input struct {
		Method         string     `json:"payment_method"`
		Email          string     `json:"email"`
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
	if _, err := mail.ParseAddress(strings.TrimSpace(input.Email)); err != nil {
		errorJSON(w, http.StatusBadRequest, "enter a valid email address for the payment receipt")
		return
	}
	if input.RequestedState != "published" && input.RequestedState != "scheduled" {
		errorJSON(w, http.StatusBadRequest, "listing must be published or scheduled after payment")
		return
	}
	var title, priceRange, currency string
	var price, storedFee float64
	var status string
	if err := s.db.QueryRow(r.Context(), `SELECT title,price,price_range,monthly_fee,currency,status FROM listings WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL`, listingID, user.ID).Scan(&title, &price, &priceRange, &storedFee, &currency, &status); err != nil {
		errorJSON(w, http.StatusNotFound, "listing not found")
		return
	}
	if status != "draft" {
		errorJSON(w, http.StatusConflict, "only a saved draft can start its first listing payment")
		return
	}
	fee, valid := listingUploadFee(price, priceRange)
	if !valid || math.Round(fee) < 1 || math.Abs(fee-storedFee) > 0.02 || currency != "RWF" {
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
	rate := math.Round((fee/price)*10000) / 100
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
	checkoutURL, err := newFlutterwaveClient(s.cfg.FlutterwaveSecretKey).startCheckout(r.Context(), txRef, strings.TrimSpace(input.Email), user.Name, redirectURL, input.Method, amount, listingID)
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
	if txRef != "" {
		_ = s.db.QueryRow(r.Context(), `SELECT related_id::text FROM payments WHERE provider='flutterwave' AND provider_reference=$1 AND related_type='listing_subscription'`, txRef).Scan(&listingID)
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
					}
				} else if strings.EqualFold(verified.Status, "successful") && paymentStatus == "pending" && s.activateListingSubscription(r, paymentID, storedListingID, verified.ID) == nil {
					resultStatus = "successful"
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
	if resultStatus == "pending" {
		returnURL += "&tx_ref=" + url.QueryEscape(txRef) + "&transaction_id=" + url.QueryEscape(transactionID)
	}
	http.Redirect(w, r, returnURL, http.StatusSeeOther)
}

func (s *Server) activateListingSubscription(r *http.Request, paymentID, listingID string, providerTransactionID int64) error {
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(r.Context())
	var requestedStatus string
	var publishAt *time.Time
	if err := tx.QueryRow(r.Context(), `SELECT requested_status,publish_at FROM listing_subscriptions WHERE payment_id=$1 AND listing_id=$2 AND status='pending' FOR UPDATE`, paymentID, listingID).Scan(&requestedStatus, &publishAt); err != nil {
		return err
	}
	start := time.Now().UTC()
	if requestedStatus == "scheduled" && publishAt != nil && publishAt.After(start) {
		start = publishAt.UTC()
	} else {
		requestedStatus = "published"
		publishAt = nil
	}
	if _, err := tx.Exec(r.Context(), `UPDATE payments SET status='successful',provider_transaction_id=$2 WHERE id=$1 AND status='pending'`, paymentID, fmt.Sprint(providerTransactionID)); err != nil {
		return err
	}
	if _, err := tx.Exec(r.Context(), `UPDATE listing_subscriptions SET status='active',period_start=$2,period_end=NULL WHERE payment_id=$1`, paymentID, start); err != nil {
		return err
	}
	result, err := tx.Exec(r.Context(), `UPDATE listings SET status=$2,publish_at=$3,expires_at=NULL,updated_at=NOW() WHERE id=$1 AND status='draft'`, listingID, requestedStatus, publishAt)
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
