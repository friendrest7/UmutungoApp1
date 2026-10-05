package httpapi

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/umutungo/umutungo/backend/internal/config"
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
