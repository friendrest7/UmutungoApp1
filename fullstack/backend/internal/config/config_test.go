package config

import "testing"

func TestResolveAppEnvFailsClosed(t *testing.T) {
	cases := map[string]string{
		"development":  EnvDevelopment,
		" Development": EnvDevelopment,
		"dev":          EnvDevelopment,
		"production":   EnvProduction,
		"prod":         EnvProduction,
		"":             EnvProduction, // missing
		"   ":          EnvProduction,
		"staging":      EnvProduction, // unknown
		"testing":      EnvProduction,
		"develop":      EnvProduction, // typo
		"Production ":  EnvProduction,
	}
	for raw, want := range cases {
		if got := ResolveAppEnv(raw); got != want {
			t.Errorf("ResolveAppEnv(%q) = %q, want %q", raw, got, want)
		}
	}
}

// Load must never switch on test logins or demo payments unless APP_ENV is
// positively "development", whatever the individual flags say.
func TestLoadDevelopmentOnlySwitches(t *testing.T) {
	cases := []struct {
		name                  string
		appEnv, tests, demo   string
		wantEnv               string
		wantTests, wantDemoOn bool
	}{
		{"missing APP_ENV, flags forced on", "", "true", "true", EnvProduction, false, false},
		{"production, flags forced on", "production", "true", "1", EnvProduction, false, false},
		{"unknown APP_ENV, flags forced on", "staging", "true", "true", EnvProduction, false, false},
		{"old testing value, flags on", "testing", "true", "true", EnvProduction, false, false},
		{"development defaults", "development", "", "", EnvDevelopment, true, true},
		{"development, logins switched off", "development", "false", "", EnvDevelopment, false, true},
		{"development, demo payments switched off", "development", "", "false", EnvDevelopment, true, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("APP_ENV", tc.appEnv)
			t.Setenv("TEST_LOGIN_ENABLED", tc.tests)
			t.Setenv("DEMO_PAYMENTS_ENABLED", tc.demo)
			t.Setenv("DATABASE_URL", "postgres://example.invalid/db")
			cfg := Load()
			if cfg.AppEnv != tc.wantEnv || cfg.TestLoginEnabled != tc.wantTests || cfg.DemoPaymentsEnabled != tc.wantDemoOn {
				t.Fatalf("got env=%q tests=%v demo=%v; want env=%q tests=%v demo=%v",
					cfg.AppEnv, cfg.TestLoginEnabled, cfg.DemoPaymentsEnabled, tc.wantEnv, tc.wantTests, tc.wantDemoOn)
			}
		})
	}
}

// Without APP_ENV the server must not fall back to the local development
// database either: production requires an explicit DATABASE_URL.
func TestLoadProductionHasNoDefaultDatabase(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("DATABASE_URL", "")
	if cfg := Load(); cfg.DatabaseURL != "" {
		t.Fatalf("production must not default DATABASE_URL, got %q", cfg.DatabaseURL)
	}
}
