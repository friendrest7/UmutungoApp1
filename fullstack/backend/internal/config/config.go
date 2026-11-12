package config

import (
	"bufio"
	"log"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	AppEnv               string
	Port                 string
	DatabaseURL          string
	CorsOrigins          string
	MigrationsPath       string
	MediaUploadDir       string
	MediaPublicBaseURL   string
	GoogleClientIDs      string
	FlutterwaveSecretKey string
	DemoPaymentsEnabled  bool
	TestLoginEnabled     bool
	FrontendBaseURL      string
	BackendPublicURL     string
	MTNAPIUser           string
	MTNAPIKey            string
	MTNSubscriptionKey   string
	MTNTargetEnvironment string
	MTNBaseURL           string
	// MTNCurrency is the currency label sent to MTN MoMo: RWF, except that
	// MTN's sandbox accepts only EUR (see ResolveMTNCurrency).
	MTNCurrency        string
	MTNSMSClientID     string
	MTNSMSClientSecret string
	MTNSMSServiceCode  string
	MTNSMSBaseURL      string
	MTNSMSTokenURL     string
	TwilioAccountSID   string
	TwilioAuthToken    string
	TwilioFromNumber   string
	// Contact verification (OTP). See .env.example for what each one does.
	AfricasTalkingUsername string
	AfricasTalkingAPIKey   string
	AfricasTalkingSenderID string
	AfricasTalkingSandbox  bool
	SMTPHost               string
	SMTPPort               string
	SMTPUsername           string
	SMTPPassword           string
	EmailFrom              string
	OTPHMACSecret          string
	TrustedProxyHops       int
	OwnerSilverPrice       float64
	OwnerGoldPrice         float64
	OwnerPlatinumPrice     float64
}

// The two environments the server knows. Anything that is not exactly
// "development" is treated as production, so a missing or mistyped APP_ENV can
// never switch on test logins or demo payments.
const (
	EnvDevelopment = "development"
	EnvProduction  = "production"
)

// ResolveAppEnv maps the APP_ENV value to EnvDevelopment or EnvProduction.
// It fails closed: empty, unknown or misspelled values become production.
func ResolveAppEnv(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "development", "dev":
		return EnvDevelopment
	case "production", "prod", "":
		return EnvProduction
	default:
		log.Printf("config: APP_ENV=%q is not recognised; running as production (development-only features stay off)", raw)
		return EnvProduction
	}
}

func Load() Config {
	loadLocalEnv()
	appEnv := ResolveAppEnv(os.Getenv("APP_ENV"))
	development := appEnv == EnvDevelopment
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" && appEnv == "development" {
		databaseURL = "postgres://umutungo:umutungo@localhost:5432/umutungo?sslmode=disable"
	}
	return Config{
		AppEnv:               appEnv,
		Port:                 env("PORT", "8080"),
		DatabaseURL:          databaseURL,
		CorsOrigins:          env("CORS_ORIGINS", "http://localhost:3000"),
		MigrationsPath:       env("MIGRATIONS_PATH", "migrations"),
		MediaUploadDir:       env("MEDIA_UPLOAD_DIR", "storage/media"),
		MediaPublicBaseURL:   env("MEDIA_PUBLIC_BASE_URL", ""),
		GoogleClientIDs:      env("GOOGLE_CLIENT_IDS", ""),
		FlutterwaveSecretKey: env("FLUTTERWAVE_SECRET_KEY", ""),
		// Development-only switches. Both default to on in development, can be
		// turned off there, and are always off in production, whatever the
		// DEMO_PAYMENTS_ENABLED / TEST_LOGIN_ENABLED variables say.
		DemoPaymentsEnabled:    development && envBoolDefault("DEMO_PAYMENTS_ENABLED", true),
		TestLoginEnabled:       development && envBoolDefault("TEST_LOGIN_ENABLED", true),
		FrontendBaseURL:        strings.TrimRight(env("FRONTEND_BASE_URL", "http://localhost:3000"), "/"),
		BackendPublicURL:       strings.TrimRight(env("BACKEND_PUBLIC_URL", "http://localhost:8080"), "/"),
		MTNAPIUser:             env("MTN_API_USER", ""),
		MTNAPIKey:              env("MTN_API_KEY", ""),
		MTNSubscriptionKey:     env("MTN_SUBSCRIPTION_KEY_PRIMARY", ""),
		MTNTargetEnvironment:   env("MTN_TARGET_ENVIRONMENT", "sandbox"),
		MTNBaseURL:             strings.TrimRight(env("MTN_BASE_URL", "https://sandbox.momodeveloper.mtn.com"), "/"),
		MTNCurrency:            ResolveMTNCurrency(os.Getenv("MTN_CURRENCY"), env("MTN_TARGET_ENVIRONMENT", "sandbox")),
		MTNSMSClientID:         env("MTN_SMS_CLIENT_ID", ""),
		MTNSMSClientSecret:     env("MTN_SMS_CLIENT_SECRET", ""),
		MTNSMSServiceCode:      env("MTN_SMS_SERVICE_CODE", ""),
		MTNSMSBaseURL:          strings.TrimRight(env("MTN_SMS_BASE_URL", "https://api.mtn.com/v3/sms"), "/"),
		MTNSMSTokenURL:         env("MTN_SMS_TOKEN_URL", "https://api.mtn.com/v1/oauth/access_token/accesstoken?grant_type=client_credentials"),
		TwilioAccountSID:       env("TWILIO_ACCOUNT_SID", ""),
		TwilioAuthToken:        env("TWILIO_AUTH_TOKEN", ""),
		TwilioFromNumber:       env("TWILIO_FROM_NUMBER", ""),
		AfricasTalkingUsername: env("AFRICASTALKING_USERNAME", ""),
		AfricasTalkingAPIKey:   env("AFRICASTALKING_API_KEY", ""),
		AfricasTalkingSenderID: env("AFRICASTALKING_SENDER_ID", ""),
		AfricasTalkingSandbox:  !strings.EqualFold(env("AFRICASTALKING_ENV", "sandbox"), "live"),
		SMTPHost:               env("SMTP_HOST", ""),
		SMTPPort:               env("SMTP_PORT", "587"),
		SMTPUsername:           env("SMTP_USERNAME", ""),
		SMTPPassword:           env("SMTP_PASSWORD", ""),
		EmailFrom:              env("EMAIL_FROM", ""),
		OTPHMACSecret:          env("OTP_HMAC_SECRET", ""),
		TrustedProxyHops:       envIntDefault("TRUSTED_PROXY_HOPS", 0),
		OwnerSilverPrice:       envFloatDefault("OWNER_SILVER_PRICE_RWF", 10000),
		OwnerGoldPrice:         envFloatDefault("OWNER_GOLD_PRICE_RWF", 20000),
		OwnerPlatinumPrice:     envFloatDefault("OWNER_PLATINUM_PRICE_RWF", 30000),
	}
}

// ResolveMTNCurrency returns the currency to send to MTN MoMo. Umutungo prices
// everything in RWF, but MTN's sandbox accepts only EUR, so MTN_CURRENCY=EUR is
// honoured when the target environment is "sandbox" and ignored everywhere
// else. Sandbox money isn't real, so the amount is sent unchanged.
func ResolveMTNCurrency(raw, targetEnvironment string) string {
	if strings.EqualFold(strings.TrimSpace(raw), "EUR") && strings.EqualFold(strings.TrimSpace(targetEnvironment), "sandbox") {
		return "EUR"
	}
	return "RWF"
}

func loadLocalEnv() {
	for _, path := range []string{".env.local", ".env.local.txt"} {
		file, err := os.Open(path)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, value, found := strings.Cut(line, "=")
			key, value = strings.TrimSpace(key), strings.TrimSpace(value)
			if !found || key == "" {
				continue
			}
			if len(value) >= 2 && ((value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'')) {
				value = value[1 : len(value)-1]
			}
			if _, exists := os.LookupEnv(key); !exists {
				_ = os.Setenv(key, value)
			}
		}
		_ = file.Close()
	}
}

func envFloatDefault(key string, fallback float64) float64 {
	value := env(key, "")
	if value == "" {
		return fallback
	}
	amount, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return amount
}

func envBoolDefault(key string, fallback bool) bool {
	value, exists := os.LookupEnv(key)
	if !exists || strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.EqualFold(strings.TrimSpace(value), "true") || strings.TrimSpace(value) == "1"
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envIntDefault(key string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(env(key, "")))
	if err != nil || value < 0 {
		return fallback
	}
	return value
}
