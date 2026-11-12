package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/umutungo/umutungo/backend/internal/config"
	"github.com/umutungo/umutungo/backend/internal/db"
)

func TestValidUUID(t *testing.T) {
	for value, want := range map[string]bool{
		"08d9a44b-1b7c-4f17-a844-982ed2551c3e": true,
		"08D9A44B-1B7C-4F17-A844-982ED2551C3E": true,
		"08d9a44b1b7c4f17a844982ed2551c3e":     false,
		"08d9a44b-1b7c-4f17-a844-982ed2551c3g": false,
		"x OR 1=1 --":                          false,
		"":                                     false,
	} {
		if got := validUUID(value); got != want {
			t.Errorf("validUUID(%q) = %v", value, got)
		}
	}
}

func TestAdvertisePropertyIntegration(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run property advertising integration tests")
	}
	ctx := context.Background()
	pool, err := db.NewPool(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := db.Migrate(ctx, pool, filepath.Join("..", "..", "migrations")); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}
	suffix, err := randomToken()
	if err != nil {
		t.Fatal(err)
	}
	newLandlord := func(label, phone string) (string, string) {
		var id string
		if err := pool.QueryRow(ctx, `INSERT INTO users(name,phone,role,workspace_kind) VALUES($1,$2,'property_owner','landlord') RETURNING id`, label, phone+suffix[:7]).Scan(&id); err != nil {
			t.Fatal(err)
		}
		token := label + "-" + suffix
		if _, err := pool.Exec(ctx, `INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')`, id, hash(token)); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			_, _ = pool.Exec(ctx, `DELETE FROM managed_properties WHERE owner_id=$1`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM listings WHERE owner_id=$1`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM audit_logs WHERE actor_id=$1`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM notifications WHERE user_id=$1`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM landlord_trials WHERE user_id=$1`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM subscriptions WHERE user_id=$1`, id)
			_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, id)
		})
		return id, token
	}
	owner, token := newLandlord("advertise-landlord", "+25072")
	other, otherToken := newLandlord("advertise-other", "+25073")
	newListing := func(ownerID, title, status string) string {
		var id string
		if err := pool.QueryRow(ctx, `INSERT INTO listings(owner_id,category,transaction_type,title,price,currency,province,district,sector,status) VALUES($1,'house','rent_out',$2,500000,'RWF','City of Kigali','Gasabo','Kacyiru',$3) RETURNING id`, ownerID, title, status).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	var property string
	if err := pool.QueryRow(ctx, `INSERT INTO managed_properties(owner_id,name,province,district,sector) VALUES($1,'Advertised Residences','City of Kigali','Gasabo','Kacyiru') RETURNING id`, owner).Scan(&property); err != nil {
		t.Fatal(err)
	}
	published := newListing(owner, "Advertised home "+suffix[:6], "published")
	second := newListing(owner, "Second home "+suffix[:6], "published")
	draft := newListing(owner, "Draft home", "draft")
	othersListing := newListing(other, "Another owner home", "published")

	handler := New(pool, config.Config{}).Handler()
	advertise := func(tok, propertyID string, body map[string]any) (int, map[string]any) {
		raw, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/owner/properties/"+propertyID+"/advertise", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer "+tok)
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		var out map[string]any
		_ = json.Unmarshal(res.Body.Bytes(), &out)
		return res.Code, out
	}
	featured := func(listingID string) bool {
		var f bool
		if err := pool.QueryRow(ctx, `SELECT is_featured FROM listings WHERE id=$1`, listingID).Scan(&f); err != nil {
			t.Fatal(err)
		}
		return f
	}

	// Refused: drafts, other owners' listings, other owners' properties.
	if code, _ := advertise(token, property, map[string]any{"listing_id": draft, "advertise": true}); code != http.StatusConflict {
		t.Fatalf("draft listing: %d", code)
	}
	if code, _ := advertise(token, property, map[string]any{"listing_id": othersListing, "advertise": true}); code != http.StatusNotFound {
		t.Fatalf("another owner's listing: %d", code)
	}
	if code, _ := advertise(otherToken, property, map[string]any{"listing_id": othersListing, "advertise": true}); code != http.StatusNotFound {
		t.Fatalf("another owner's property: %d", code)
	}
	if code, _ := advertise(token, "not-a-uuid", map[string]any{"advertise": true}); code != http.StatusNotFound {
		t.Fatalf("bad property id: %d", code)
	}

	// The trial plan allows advertising: listing linked and recommended.
	if code, out := advertise(token, property, map[string]any{"listing_id": published, "advertise": true}); code != http.StatusOK || out["featured"] != true {
		t.Fatalf("advertise: %d %v", code, out)
	}
	if !featured(published) {
		t.Fatal("listing should be featured")
	}
	// The workspace reports the link.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/owner/workspace", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	var workspace struct {
		Properties []struct {
			ID      string `json:"id"`
			Listing *struct {
				ID       string `json:"id"`
				Featured bool   `json:"featured"`
			} `json:"listing"`
		} `json:"properties"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &workspace); err != nil || len(workspace.Properties) != 1 || workspace.Properties[0].Listing == nil || workspace.Properties[0].Listing.ID != published || !workspace.Properties[0].Listing.Featured {
		t.Fatalf("workspace property listing: %d %s", res.Code, res.Body.String())
	}

	// Switching to another listing moves the recommendation.
	if code, _ := advertise(token, property, map[string]any{"listing_id": second, "advertise": true}); code != http.StatusOK {
		t.Fatalf("switch: %d", code)
	}
	if featured(published) || !featured(second) {
		t.Fatal("switching listings should move the recommendation")
	}
	// A listing can advertise only one property.
	var property2 string
	if err := pool.QueryRow(ctx, `INSERT INTO managed_properties(owner_id,name,province,district,sector) VALUES($1,'Second Residences','City of Kigali','Gasabo','Remera') RETURNING id`, owner).Scan(&property2); err != nil {
		t.Fatal(err)
	}
	if code, _ := advertise(token, property2, map[string]any{"listing_id": second, "advertise": true}); code != http.StatusConflict {
		t.Fatalf("listing reused for second property: %d", code)
	}
	// Stopping keeps the link but removes the recommendation.
	if code, out := advertise(token, property, map[string]any{"advertise": false}); code != http.StatusOK || out["featured"] != false {
		t.Fatalf("stop: %d %v", code, out)
	}
	if featured(second) {
		t.Fatal("listing should no longer be featured")
	}
	// Advertising again without choosing reuses the linked listing.
	if code, _ := advertise(token, property, map[string]any{"advertise": true}); code != http.StatusOK || !featured(second) {
		t.Fatalf("re-advertise linked listing: %d", code)
	}

	// Without an active plan, advertising is refused (workspace locked).
	if _, err := pool.Exec(ctx, `UPDATE subscriptions SET starts_at=NOW()-INTERVAL '31 days', ends_at=NOW()-INTERVAL '1 minute' WHERE user_id=$1`, owner); err != nil {
		t.Fatal(err)
	}
	if code, _ := advertise(token, property, map[string]any{"listing_id": published, "advertise": true}); code != http.StatusPaymentRequired {
		t.Fatalf("expired plan: %d", code)
	}
}
