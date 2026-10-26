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
	"time"

	"github.com/umutungo/umutungo/backend/internal/config"
	"github.com/umutungo/umutungo/backend/internal/db"
)

func TestBookingQuoteDailyAndMonthly(t *testing.T) {
	tests := []struct {
		name, period string
		nights       int
		units        int
	}{
		{"daily nights", "daily", 3, 3},
		{"monthly partial block rounds up", "monthly", 31, 2},
		{"monthly exact block", "monthly", 60, 2},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			quote, err := calculateBookingQuote(125000, test.nights, test.period)
			if err != nil {
				t.Fatal(err)
			}
			if quote.BilledUnits != test.units || quote.BaseAmount != int64(test.units)*125000 || quote.TotalAmount != quote.BaseAmount || quote.ServiceFeeAmount != 0 || quote.Currency != "RWF" {
				t.Fatalf("unexpected quote: %+v", quote)
			}
		})
	}
}

func TestBookingQuoteRejectsInvalidValues(t *testing.T) {
	for _, test := range []struct {
		rate   int64
		nights int
		period string
	}{{0, 1, "daily"}, {1, 0, "daily"}, {mathMaxInt64, 2, "daily"}, {1, 1, "weekly"}} {
		if _, err := calculateBookingQuote(test.rate, test.nights, test.period); err == nil {
			t.Errorf("calculateBookingQuote(%d,%d,%q) unexpectedly succeeded", test.rate, test.nights, test.period)
		}
	}
}

const mathMaxInt64 = int64(^uint64(0) >> 1)

func TestBookingDateValidationAndOverlap(t *testing.T) {
	now := time.Date(2026, time.October, 26, 12, 0, 0, 0, time.UTC)
	start, end, nights, err := parseBookingDates("2026-10-27", "2026-10-30", now)
	if err != nil || nights != 3 {
		t.Fatalf("valid dates: nights=%d err=%v", nights, err)
	}
	if _, _, _, err := parseBookingDates("2026-10-30", "2026-10-30", now); err == nil {
		t.Fatal("same-day booking should be rejected")
	}
	if _, _, _, err := parseBookingDates("2026-10-25", "2026-10-27", now); err == nil {
		t.Fatal("past check-in should be rejected")
	}
	if !bookingDateRangesOverlap(start, end, start.Add(48*time.Hour), end.Add(24*time.Hour)) {
		t.Fatal("overlapping ranges were not detected")
	}
	if bookingDateRangesOverlap(start, end, end, end.Add(24*time.Hour)) {
		t.Fatal("back-to-back ranges should not overlap")
	}
}

func TestBookingConflictAndPaymentIdempotencyIntegration(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run booking and payment database integration")
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
	var ownerID, guestOneID, guestTwoID, listingID string
	for _, user := range []struct {
		name, phone, role string
		id                *string
	}{
		{"Booking Owner", "+2507owner" + suffix[:12], "property_owner", &ownerID},
		{"Booking Guest One", "+2507guest1" + suffix[:12], "client", &guestOneID},
		{"Booking Guest Two", "+2507guest2" + suffix[:12], "client", &guestTwoID},
	} {
		if err := pool.QueryRow(ctx, `INSERT INTO users(name,phone,role) VALUES($1,$2,$3) RETURNING id`, user.name, user.phone, user.role).Scan(user.id); err != nil {
			t.Fatal(err)
		}
	}
	if err := pool.QueryRow(ctx, `INSERT INTO listings(owner_id,category,transaction_type,title,price,currency,province,district,sector,status) VALUES($1,'house','book','Booking integration',$2,'RWF','City of Kigali','Gasabo','Kacyiru','published') RETURNING id`, ownerID, 125000).Scan(&listingID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM payments WHERE user_id IN ($1,$2)`, guestOneID, guestTwoID)
		_, _ = pool.Exec(ctx, `DELETE FROM bookings WHERE listing_id=$1`, listingID)
		_, _ = pool.Exec(ctx, `DELETE FROM listings WHERE id=$1`, listingID)
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id IN ($1,$2,$3)`, ownerID, guestOneID, guestTwoID)
	})
	tokens := []struct{ userID, token string }{{ownerID, "book-owner-" + suffix}, {guestOneID, "book-guest1-" + suffix}, {guestTwoID, "book-guest2-" + suffix}}
	for _, session := range tokens {
		if _, err := pool.Exec(ctx, `INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')`, session.userID, hash(session.token)); err != nil {
			t.Fatal(err)
		}
	}
	handler := New(pool, config.Config{CorsOrigins: "http://localhost:3000"}).Handler()
	start := time.Now().In(mustKigali()).AddDate(0, 0, 10).Format("2006-01-02")
	end := time.Now().In(mustKigali()).AddDate(0, 0, 13).Format("2006-01-02")
	createBooking := func(token, key string) *httptest.ResponseRecorder {
		payload, _ := json.Marshal(map[string]any{"listing_id": listingID, "check_in": start, "check_out": end, "guests": 2, "pricing_period": "daily", "idempotency_key": key})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/bookings", bytes.NewReader(payload))
		req.Header.Set("Authorization", "Bearer "+token)
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		return res
	}
	first := createBooking(tokens[1].token, "first-"+suffix)
	if first.Code != http.StatusCreated {
		t.Fatalf("first booking status=%d body=%s", first.Code, first.Body.String())
	}
	var created struct {
		ID    string       `json:"id"`
		Quote bookingQuote `json:"quote"`
	}
	if err := json.Unmarshal(first.Body.Bytes(), &created); err != nil || created.ID == "" || created.Quote.TotalAmount != 375000 {
		t.Fatalf("booking response=%s err=%v", first.Body.String(), err)
	}
	replay := createBooking(tokens[1].token, "first-"+suffix)
	var replayBody map[string]any
	_ = json.Unmarshal(replay.Body.Bytes(), &replayBody)
	if replay.Code != http.StatusOK || replayBody["id"] != created.ID {
		t.Fatalf("idempotent replay status=%d body=%s", replay.Code, replay.Body.String())
	}
	second := createBooking(tokens[2].token, "second-"+suffix)
	if second.Code != http.StatusCreated {
		t.Fatalf("second booking status=%d body=%s", second.Code, second.Body.String())
	}
	var secondBody struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(second.Body.Bytes(), &secondBody)
	decide := func(id string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/bookings/"+id+"/decision", bytes.NewBufferString(`{"status":"confirmed"}`))
		req.Header.Set("Authorization", "Bearer "+tokens[0].token)
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		return res
	}
	if response := decide(created.ID); response.Code != http.StatusOK {
		t.Fatalf("confirm first status=%d body=%s", response.Code, response.Body.String())
	}
	if response := decide(secondBody.ID); response.Code != http.StatusConflict {
		t.Fatalf("overlap confirmation status=%d body=%s", response.Code, response.Body.String())
	}
	var paymentID string
	if err := pool.QueryRow(ctx, `INSERT INTO payments(user_id,related_type,related_id,amount,currency,provider,provider_reference,status) VALUES($1,'booking',$2,$3,'RWF','mtn_momo',$4,'pending') RETURNING id`, guestOneID, created.ID, created.Quote.TotalAmount, "payment-"+suffix).Scan(&paymentID); err != nil {
		t.Fatal(err)
	}
	server := New(pool, config.Config{})
	for range 2 {
		if err := server.applyVerifiedPayment(ctx, paymentID, "successful", "provider-tx-"+suffix); err != nil {
			t.Fatalf("apply verified payment: %v", err)
		}
	}
	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM payments WHERE id=$1`, paymentID).Scan(&status); err != nil || status != "successful" {
		t.Fatalf("payment status=%q err=%v", status, err)
	}
	var notices int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM notifications WHERE type='payment_confirmed' AND user_id IN ($1,$2) AND created_at > NOW()-INTERVAL '1 minute'`, ownerID, guestOneID).Scan(&notices); err != nil || notices != 2 {
		t.Fatalf("payment notification count=%d err=%v; want one for renter and owner", notices, err)
	}
}

func mustKigali() *time.Location {
	location, err := time.LoadLocation("Africa/Kigali")
	if err != nil {
		panic(err)
	}
	return location
}
