package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// A landlord's private property (units, tenants, rent) can be advertised by
// linking it to one of their published marketplace listings. Advertising
// recommends that listing: it is shown first on the landing page and marked
// Recommended/Featured on the marketplace (see listListings' is_featured).

// propertyListing is the "listing" field of a workspace property: the linked
// marketplace listing, or nil when the property is not linked.
func propertyListing(id, title, status string, featured bool) map[string]any {
	if id == "" {
		return nil
	}
	return map[string]any{"id": id, "title": title, "status": status, "featured": featured}
}

// ownerPropertyAdvertise serves POST /api/v1/owner/properties/{id}/advertise.
//
//	{"listing_id": "...", "advertise": true}  link the listing and recommend it
//	{"advertise": false}                      stop recommending the linked listing
func (s *Server) ownerPropertyAdvertise(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "property_owner" {
		errorJSON(w, http.StatusForbidden, "property owner access required")
		return
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/owner/properties/"), "/"), "/")
	if len(parts) != 2 || parts[1] != "advertise" || !validUUID(parts[0]) {
		errorJSON(w, http.StatusNotFound, "route not found")
		return
	}
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use POST")
		return
	}
	if !s.requireLandlordAccess(w, r, user) {
		return
	}
	propertyID := parts[0]
	var in struct {
		ListingID string `json:"listing_id"`
		Advertise *bool  `json:"advertise"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if in.Advertise == nil {
		errorJSON(w, http.StatusBadRequest, "advertise must be true or false")
		return
	}
	in.ListingID = strings.TrimSpace(in.ListingID)
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not update advertising")
		return
	}
	defer tx.Rollback(ctx)

	var linked string
	err = tx.QueryRow(ctx, `SELECT COALESCE(listing_id::text,'') FROM managed_properties WHERE id=$1 AND owner_id=$2 FOR UPDATE`, propertyID, user.ID).Scan(&linked)
	if errors.Is(err, pgx.ErrNoRows) {
		errorJSON(w, http.StatusNotFound, "property not found")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not update advertising")
		return
	}

	if !*in.Advertise {
		if linked != "" {
			if _, err := tx.Exec(ctx, `UPDATE listings SET is_featured=FALSE,updated_at=NOW() WHERE id=$1 AND owner_id=$2`, linked, user.ID); err != nil {
				errorJSON(w, http.StatusInternalServerError, "could not update advertising")
				return
			}
		}
		if err := writeAudit(ctx, tx, user.ID, "property.advertising_stopped", "managed_property", propertyID, nil, map[string]any{"listing_id": linked}); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not update advertising")
			return
		}
		if err := tx.Commit(ctx); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not update advertising")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"property_id": propertyID, "listing_id": linked, "featured": false})
		return
	}

	listingID := in.ListingID
	if listingID == "" {
		listingID = linked
	}
	if !validUUID(listingID) {
		errorJSON(w, http.StatusBadRequest, "choose a published listing to advertise this property")
		return
	}
	var status string
	err = tx.QueryRow(ctx, `SELECT status FROM listings WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL FOR UPDATE`, listingID, user.ID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		errorJSON(w, http.StatusNotFound, "listing not found")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not update advertising")
		return
	}
	if status != "published" {
		errorJSON(w, http.StatusConflict, "only a published listing can be advertised; publish it first")
		return
	}
	canFeature, err := s.canFeatureListing(ctx, user, listingID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not verify your plan")
		return
	}
	if !canFeature {
		errorJSON(w, http.StatusForbidden, "an active Silver, Gold, or Platinum plan is required to advertise properties")
		return
	}
	// Switching to a different listing stops recommending the old one.
	if linked != "" && linked != listingID {
		if _, err := tx.Exec(ctx, `UPDATE listings SET is_featured=FALSE,updated_at=NOW() WHERE id=$1 AND owner_id=$2`, linked, user.ID); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not update advertising")
			return
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE managed_properties SET listing_id=$1,updated_at=NOW() WHERE id=$2 AND owner_id=$3`, listingID, propertyID, user.ID); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			errorJSON(w, http.StatusConflict, "that listing already advertises another of your properties")
			return
		}
		errorJSON(w, http.StatusInternalServerError, "could not update advertising")
		return
	}
	if _, err := tx.Exec(ctx, `UPDATE listings SET is_featured=TRUE,updated_at=NOW() WHERE id=$1 AND owner_id=$2`, listingID, user.ID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not update advertising")
		return
	}
	if err := writeAudit(ctx, tx, user.ID, "property.advertised", "managed_property", propertyID, nil, map[string]any{"listing_id": listingID}); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not update advertising")
		return
	}
	if err := tx.Commit(ctx); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not update advertising")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"property_id": propertyID, "listing_id": listingID, "featured": true})
}

// validUUID reports whether value is a canonical UUID, so malformed ids get a
// 404/400 instead of a database cast error.
func validUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for i, c := range value {
		switch {
		case i == 8 || i == 13 || i == 18 || i == 23:
			if c != '-' {
				return false
			}
		case (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'):
		default:
			return false
		}
	}
	return true
}
