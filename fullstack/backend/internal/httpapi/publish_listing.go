package httpapi

import (
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
)

// publishListingWithEntitlement publishes (or schedules) a draft using the
// first entitlement that covers it, chosen by choosePublishEntitlement:
// an individual listing payment, then plan allowance, then a listing credit.
// A listing paused because a plan lapsed or shrank can be re-published the
// same way.
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
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start publication")
		return
	}
	defer tx.Rollback(ctx)
	// Lock the account so two concurrent publishes cannot both use the last
	// unit of plan allowance.
	if _, err := tx.Exec(ctx, `SELECT 1 FROM users WHERE id=$1 FOR UPDATE`, user.ID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start publication")
		return
	}
	var status, pausedReason, source string
	var deletedAt *time.Time
	err = tx.QueryRow(ctx, `SELECT status,paused_reason,entitlement_source,deleted_at FROM listings WHERE id=$1 AND owner_id=$2 FOR UPDATE`, id, user.ID).Scan(&status, &pausedReason, &source, &deletedAt)
	if err != nil || deletedAt != nil {
		errorJSON(w, http.StatusConflict, "only an active saved draft can be published")
		return
	}
	var paidListing, consumedCredit bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM listing_subscriptions WHERE listing_id=$1 AND owner_id=$2 AND status='active'),
		EXISTS(SELECT 1 FROM listing_upload_slots WHERE listing_id=$1 AND status='consumed')`, id, user.ID).Scan(&paidListing, &consumedCredit); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not verify the listing payment")
		return
	}
	if status == input.RequestedStatus && (paidListing || consumedCredit || source == publishViaPlan) {
		writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": status, "entitlement": entitlementResponseName(source, paidListing)})
		return
	}
	republishing := status == "paused" && (pausedReason == "plan_expired" || pausedReason == "plan_limit")
	if status != "draft" && !republishing {
		errorJSON(w, http.StatusConflict, "only an active saved draft can be published")
		return
	}
	entitlements, err := resolveEntitlements(ctx, tx, user)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not verify your plan")
		return
	}
	via, err := choosePublishEntitlement(paidListing, entitlements)
	if errors.Is(err, errPublishPaymentRequired) {
		message := "complete the one-time listing payment before publishing"
		switch {
		case postingRole(user) == "komisiyoneri":
			message = "payment required before this listing can be published: choose a plan or buy listing credits"
		case entitlements.Source == sourceSubscription:
			message = "your plan's listing allowance is used up: upgrade your plan or pay for this listing"
		case postingRole(user) == "landlord":
			message = "complete the Landlord posting payment or choose a plan before publishing"
		}
		writeJSON(w, http.StatusPaymentRequired, map[string]any{"error": message, "entitlements": entitlements})
		return
	}
	var expiresAt *time.Time
	if via != publishViaPlan {
		expiryDays, err := s.listingExpiryDays(ctx, user)
		if err != nil {
			errorJSON(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		expires := startAt.Add(time.Duration(expiryDays) * 24 * time.Hour)
		expiresAt = &expires
	}
	if via == publishViaCredit {
		var slotID string
		err := tx.QueryRow(ctx, `SELECT id FROM listing_upload_slots WHERE owner_id=$1 AND status='available' ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`, user.ID).Scan(&slotID)
		if errors.Is(err, pgx.ErrNoRows) {
			errorJSON(w, http.StatusPaymentRequired, "payment required before this listing can be published")
			return
		}
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not verify listing credits")
			return
		}
		result, err := tx.Exec(ctx, `UPDATE listing_upload_slots SET status='consumed',listing_id=$2,consumed_at=NOW() WHERE id=$1 AND status='available'`, slotID, id)
		if err != nil || result.RowsAffected() != 1 {
			errorJSON(w, http.StatusConflict, "this listing credit was already used")
			return
		}
	}
	var publishAt *time.Time
	if input.RequestedStatus == "scheduled" {
		publishAt = &startAt
	}
	result, err := tx.Exec(ctx, `UPDATE listings SET status=$3,publish_at=COALESCE($4,NOW()),expires_at=$5,entitlement_source=$6,paused_reason='',updated_at=NOW()
		WHERE id=$1 AND owner_id=$2 AND status IN ('draft','paused') AND deleted_at IS NULL`, id, user.ID, input.RequestedStatus, publishAt, expiresAt, via)
	if err != nil || result.RowsAffected() != 1 {
		log.Printf("publish update failed for listing %s: %v", id, err)
		errorJSON(w, http.StatusInternalServerError, "could not publish listing")
		return
	}
	if err := tx.Commit(ctx); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not publish listing")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": input.RequestedStatus, "entitlement": entitlementResponseName(via, via == publishViaListingPayment)})
}

// entitlementResponseName keeps the response values existing clients know
// ("subscription" = paid per listing, "upload_slot" = credit) and adds "plan".
func entitlementResponseName(source string, paidListing bool) string {
	switch {
	case paidListing || source == publishViaListingPayment:
		return "subscription"
	case source == publishViaCredit:
		return "upload_slot"
	case source == publishViaPlan:
		return "plan"
	default:
		return source
	}
}
