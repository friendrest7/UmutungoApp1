package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/umutungo/umutungo/backend/internal/config"
	"github.com/umutungo/umutungo/backend/internal/db"
)

func TestRootAndHealthEndpoints(t *testing.T) {
	handler := New(nil, config.Config{CorsOrigins: "http://localhost:3000"}).Handler()

	tests := []struct {
		name string
		path string
		want string
	}{
		{name: "root", path: "/", want: `"service":"umutungo-api"`},
		{name: "health", path: "/health", want: `"status":"ok"`},
		{name: "healthz", path: "/healthz", want: `"status":"ok"`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
			}
			body, _ := io.ReadAll(response.Body)
			if !strings.Contains(string(body), test.want) {
				t.Fatalf("body = %q, want to contain %q", body, test.want)
			}
		})
	}
}

// This test uses a dedicated TEST_DATABASE_URL so it can exercise real SQL,
// media persistence, schedule promotion, and cross-user public access.
func TestListingVisibilityAndScheduledPublicationIntegration(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run the database-backed listing integration test")
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
	ownerPhone, viewerPhone := "+2507"+suffix[:8], "+2508"+suffix[:8]
	var ownerID, viewerID string
	if err := pool.QueryRow(ctx, `INSERT INTO users(name,phone,role) VALUES('Integration Owner',$1,'property_owner') RETURNING id`, ownerPhone).Scan(&ownerID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users(name,phone,role) VALUES('Integration Viewer',$1,'client') RETURNING id`, viewerPhone).Scan(&viewerID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM listings WHERE owner_id=$1`, ownerID)
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id IN ($1,$2)`, ownerID, viewerID)
	})
	ownerToken, viewerToken := "integration-owner-"+suffix, "integration-viewer-"+suffix
	for _, session := range []struct{ userID, token string }{{ownerID, ownerToken}, {viewerID, viewerToken}} {
		if _, err := pool.Exec(ctx, `INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')`, session.userID, hash(session.token)); err != nil {
			t.Fatal(err)
		}
	}
	mediaDir := t.TempDir()
	handler := New(pool, config.Config{CorsOrigins: "http://localhost:3000", MediaUploadDir: mediaDir}).Handler()
	future := time.Now().Add(5 * time.Minute).UTC().Format(time.RFC3339Nano)
	payload, _ := json.Marshal(map[string]any{"category": "house", "transaction_type": "sell", "title": "Integration listing " + suffix[:8], "description": "Database-backed test property", "price": 1234567, "currency": "RWF", "province": "City of Kigali", "district": "Gasabo", "sector": "Kacyiru", "publish_at": future, "media": []any{}})
	create := httptest.NewRequest(http.MethodPost, "/api/v1/listings", bytes.NewReader(payload))
	create.Header.Set("Authorization", "Bearer "+ownerToken)
	created := httptest.NewRecorder()
	handler.ServeHTTP(created, create)
	if created.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", created.Code, created.Body.String())
	}
	var listing struct{ ID, Status string }
	if err := json.Unmarshal(created.Body.Bytes(), &listing); err != nil || listing.ID == "" || listing.Status != "scheduled" {
		t.Fatalf("create response = %s, err = %v", created.Body.String(), err)
	}
	viewerGet := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer "+viewerToken)
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		return res
	}
	for _, path := range []string{"/api/v1/listings", "/api/v1/listings?search=" + urlQuery("Integration listing"), "/api/v1/listings?category=house"} {
		response := viewerGet(path)
		if response.Code != http.StatusOK || strings.Contains(response.Body.String(), listing.ID) {
			t.Fatalf("future listing leaked at %s: status %d body %s", path, response.Code, response.Body.String())
		}
	}
	if response := viewerGet("/api/v1/listings/" + listing.ID); response.Code != http.StatusNotFound {
		t.Fatalf("scheduled detail status = %d; want 404", response.Code)
	}
	var invalidUpload bytes.Buffer
	invalidWriter := multipart.NewWriter(&invalidUpload)
	invalidPart, err := invalidWriter.CreateFormFile("file", "not-an-image.txt")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = invalidPart.Write([]byte("not an image"))
	_ = invalidWriter.Close()
	invalidReq := httptest.NewRequest(http.MethodPost, "/api/v1/listings/"+listing.ID+"/media", &invalidUpload)
	invalidReq.Header.Set("Authorization", "Bearer "+ownerToken)
	invalidReq.Header.Set("Content-Type", invalidWriter.FormDataContentType())
	invalidRes := httptest.NewRecorder()
	handler.ServeHTTP(invalidRes, invalidReq)
	if invalidRes.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("invalid image upload status = %d, want 415", invalidRes.Code)
	}
	// Store a PNG signature payload using the authenticated owner upload route.
	var upload bytes.Buffer
	writer := multipart.NewWriter(&upload)
	part, err := writer.CreateFormFile("file", "sample.png")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write([]byte("\x89PNG\r\n\x1a\n"))
	_ = writer.Close()
	imageReq := httptest.NewRequest(http.MethodPost, "/api/v1/listings/"+listing.ID+"/media", &upload)
	imageReq.Header.Set("Authorization", "Bearer "+ownerToken)
	imageReq.Header.Set("Content-Type", writer.FormDataContentType())
	imageRes := httptest.NewRecorder()
	handler.ServeHTTP(imageRes, imageReq)
	if imageRes.Code != http.StatusCreated {
		t.Fatalf("image upload status = %d body=%s", imageRes.Code, imageRes.Body.String())
	}
	if _, err := pool.Exec(ctx, `UPDATE listings SET publish_at=NOW()-INTERVAL '1 second' WHERE id=$1`, listing.ID); err != nil {
		t.Fatal(err)
	}
	public := viewerGet("/api/v1/listings?search=" + urlQuery("Integration listing"))
	if public.Code != http.StatusOK || !strings.Contains(public.Body.String(), listing.ID) || !strings.Contains(public.Body.String(), "created_at") {
		t.Fatalf("published search did not expose listing/date: %d %s", public.Code, public.Body.String())
	}
	if category := viewerGet("/api/v1/listings?category=house"); !strings.Contains(category.Body.String(), listing.ID) {
		t.Fatalf("category did not expose listing: %s", category.Body.String())
	}
	detail := viewerGet("/api/v1/listings/" + listing.ID)
	if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), "created_at") || !strings.Contains(detail.Body.String(), "images") || !strings.Contains(detail.Body.String(), ".png") {
		t.Fatalf("detail missing listed date or uploaded image: %d %s", detail.Code, detail.Body.String())
	}
	ownerReq := httptest.NewRequest(http.MethodGet, "/api/v1/owner/listings", nil)
	ownerReq.Header.Set("Authorization", "Bearer "+ownerToken)
	ownerRes := httptest.NewRecorder()
	handler.ServeHTTP(ownerRes, ownerReq)
	if ownerRes.Code != http.StatusOK || !strings.Contains(ownerRes.Body.String(), listing.ID) || !strings.Contains(ownerRes.Body.String(), "published") {
		t.Fatalf("owner dashboard did not reflect published listing: %d %s", ownerRes.Code, ownerRes.Body.String())
	}
}

func urlQuery(value string) string { return strings.ReplaceAll(strings.TrimSpace(value), " ", "+") }

func TestCORSPreflight(t *testing.T) {
	handler := New(nil, config.Config{CorsOrigins: "https://app.example"}).Handler()
	request := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/request-otp", nil)
	request.Header.Set("Origin", "https://app.example")
	request.Header.Set("Access-Control-Request-Method", http.MethodPost)
	request.Header.Set("Access-Control-Request-Headers", "authorization, content-type")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example" {
		t.Fatalf("allow-origin = %q, want exact configured origin", got)
	}
	if got := response.Header().Get("Access-Control-Allow-Methods"); !strings.Contains(got, http.MethodPost) {
		t.Fatalf("allow-methods = %q, want POST", got)
	}
}

func TestMediaURLValidation(t *testing.T) {
	valid := []string{"https://cdn.example.com/property.jpg", "http://localhost:8080/uploads/a.jpg"}
	for _, value := range valid {
		if !validMediaURL(value) {
			t.Errorf("validMediaURL(%q) = false, want true", value)
		}
	}
	invalid := []string{"", "data:image/png;base64,abc", "javascript:alert(1)", "https:///missing-host", "https://" + strings.Repeat("a", 2050)}
	for _, value := range invalid {
		if validMediaURL(value) {
			t.Errorf("validMediaURL(%q) = true, want false", value)
		}
	}
}

func TestConfiguredGoogleClientIDs(t *testing.T) {
	got := configuredGoogleClientIDs(" android.apps.googleusercontent.com, web.apps.googleusercontent.com,android.apps.googleusercontent.com ")
	if len(got) != 2 || got[0] != "android.apps.googleusercontent.com" || got[1] != "web.apps.googleusercontent.com" {
		t.Fatalf("configuredGoogleClientIDs() = %#v, want two unique trimmed IDs", got)
	}
}
