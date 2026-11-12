package httpapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/umutungo/umutungo/backend/internal/config"
)

// These tests need no database: every request below is answered before the
// handler would touch one.

func postJSON(t *testing.T, handler http.Handler, method, path, body string) int {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec.Code
}

func TestTestLoginsNeedDevelopment(t *testing.T) {
	cases := []struct {
		cfg  config.Config
		want bool
	}{
		{config.Config{AppEnv: config.EnvProduction, TestLoginEnabled: true}, false},
		{config.Config{AppEnv: "", TestLoginEnabled: true}, false},
		{config.Config{AppEnv: "testing", TestLoginEnabled: true}, false},
		{config.Config{AppEnv: config.EnvDevelopment, TestLoginEnabled: false}, false},
		{config.Config{AppEnv: config.EnvDevelopment, TestLoginEnabled: true}, true},
	}
	for _, tc := range cases {
		if got := New(nil, tc.cfg).testLoginsEnabled(); got != tc.want {
			t.Errorf("AppEnv=%q TestLoginEnabled=%v: got %v, want %v", tc.cfg.AppEnv, tc.cfg.TestLoginEnabled, got, tc.want)
		}
	}
}

func TestDemoPaymentsNeverInProduction(t *testing.T) {
	if New(nil, config.Config{AppEnv: config.EnvProduction, DemoPaymentsEnabled: true}).demoPaymentsEnabled() {
		t.Fatal("demo payments must be off in production even if the flag is set")
	}
	if !New(nil, config.Config{AppEnv: config.EnvDevelopment, DemoPaymentsEnabled: true}).demoPaymentsEnabled() {
		t.Fatal("demo payments should work in development when enabled")
	}
}

// In production the routes are not registered, so even a request carrying the
// old test-account credentials gets the generic 404.
func TestDevLoginRoutesAbsentInProduction(t *testing.T) {
	// The worst case: someone set the development flags on a production server.
	handler := New(nil, config.Config{AppEnv: config.EnvProduction, TestLoginEnabled: true, DemoPaymentsEnabled: true}).Handler()
	for _, path := range []string{"/api/v1/auth/dev-login", "/api/v1/auth/dev-admin"} {
		for _, body := range []string{`{}`, `{"email":"admin@umutungo.test","password":"Admin123!"}`} {
			if code := postJSON(t, handler, http.MethodPost, path, body); code != http.StatusNotFound {
				t.Fatalf("%s in production: status %d, want 404", path, code)
			}
		}
	}
	// A server that was configured by hand without any APP_ENV is production too.
	handler = New(nil, config.Config{TestLoginEnabled: true}).Handler()
	if code := postJSON(t, handler, http.MethodPost, "/api/v1/auth/dev-login", `{"email":"admin@umutungo.test"}`); code != http.StatusNotFound {
		t.Fatalf("dev-login without APP_ENV: status %d, want 404", code)
	}
}

// The handlers refuse on their own as well, in case they are ever called
// without going through Handler().
func TestDevLoginHandlersRefuseOutsideDevelopment(t *testing.T) {
	s := New(nil, config.Config{AppEnv: config.EnvProduction, TestLoginEnabled: true})
	for name, handle := range map[string]http.HandlerFunc{"dev-login": s.devLogin, "dev-admin": s.devAdminLogin} {
		rec := httptest.NewRecorder()
		handle(rec, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"email":"admin@umutungo.test"}`)))
		if rec.Code != http.StatusNotFound {
			t.Fatalf("%s handler in production: status %d, want 404", name, rec.Code)
		}
	}
}

func TestDevLoginRoutesPresentInDevelopment(t *testing.T) {
	handler := New(nil, config.Config{AppEnv: config.EnvDevelopment, TestLoginEnabled: true}).Handler()
	// Registered: the wrong method is refused by the handler, not the 404 root.
	if code := postJSON(t, handler, http.MethodGet, "/api/v1/auth/dev-login", ""); code != http.StatusMethodNotAllowed {
		t.Fatalf("dev-login GET in development: status %d, want 405", code)
	}
	// Only the documented test accounts exist; anything else is refused
	// before the database is used.
	if code := postJSON(t, handler, http.MethodPost, "/api/v1/auth/dev-login", `{"email":"someone@example.com","password":"x"}`); code != http.StatusUnauthorized {
		t.Fatalf("unknown dev account: status %d, want 401", code)
	}
	if code := postJSON(t, handler, http.MethodPost, "/api/v1/auth/dev-admin", `{"email":"owner@umutungo.test"}`); code != http.StatusUnauthorized {
		t.Fatalf("dev-admin with a non-admin account: status %d, want 401", code)
	}
}

func TestDemoListingPaymentRefusedInProduction(t *testing.T) {
	handler := New(nil, config.Config{AppEnv: config.EnvProduction, DemoPaymentsEnabled: true}).Handler()
	if code := postJSON(t, handler, http.MethodPost, "/api/v1/listings/00000000-0000-0000-0000-000000000000/demo-payment", `{}`); code != http.StatusNotFound {
		t.Fatalf("demo listing payment in production: status %d, want 404", code)
	}
}

// The test-account passwords must not appear in any client source again.
func TestNoTestPasswordsInClientSource(t *testing.T) {
	root := filepath.Join("..", "..", "..", "..")
	dirs := []string{
		filepath.Join(root, "fullstack", "frontend", "src"),
		filepath.Join(root, "mobile", "app"),
		filepath.Join(root, "mobile", "src"),
	}
	secrets := []string{"Admin123!", "Owner123!", "Landlord123!", "Tenant123!", "Client123!", "Commissioner123!"}
	checked := 0
	for _, dir := range dirs {
		if _, err := os.Stat(dir); err != nil {
			continue
		}
		err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return err
			}
			if ext := filepath.Ext(path); ext != ".ts" && ext != ".tsx" && ext != ".js" && ext != ".jsx" {
				return nil
			}
			data, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			checked++
			for _, secret := range secrets {
				if strings.Contains(string(data), secret) {
					t.Errorf("%s contains the old test password %q", path, secret)
				}
			}
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	if checked == 0 {
		t.Skip("client source folders not found next to the backend")
	}
}

// Backend source must not hold them either; dev logins pick accounts by email.
func TestNoTestPasswordsInBackendSource(t *testing.T) {
	data, err := os.ReadFile("server.go")
	if err != nil {
		t.Fatal(err)
	}
	for _, secret := range []string{"Admin123!", "Owner123!", "Landlord123!", "Tenant123!", "Client123!", "Commissioner123!"} {
		if strings.Contains(string(data), secret) {
			t.Errorf("server.go still contains %q", secret)
		}
	}
}
