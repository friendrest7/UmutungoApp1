package config

import (
	"bufio"
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
	MTNAPIUser           string
	MTNAPIKey            string
	MTNSubscriptionKey   string
	MTNTargetEnvironment string
	MTNBaseURL           string
	MTNSMSClientID       string
	MTNSMSClientSecret   string
	MTNSMSServiceCode    string
	MTNSMSBaseURL        string
	MTNSMSTokenURL       string
	TwilioAccountSID     string
	TwilioAuthToken      string
	TwilioFromNumber     string
	OwnerSilverPrice     float64
	OwnerGoldPrice       float64
	OwnerPlatinumPrice   float64
}

func Load() Config {
	loadLocalEnv()
	appEnv := env("APP_ENV", "development")
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
		GoogleClientIDs:      env("GOOGLE_CLIENT_IDS", "947964372839-5mbve9eh4k07qpqkvm0h7cp35tm9rj8o.apps.googleusercontent.com,128904720035-13hdispbjdum6iphqb3e1ct5ohmdnkb1.apps.googleusercontent.com"),
		MTNAPIUser:           env("MTN_API_USER", ""),
		MTNAPIKey:            env("MTN_API_KEY", ""),
		MTNSubscriptionKey:   env("MTN_SUBSCRIPTION_KEY_PRIMARY", ""),
		MTNTargetEnvironment: env("MTN_TARGET_ENVIRONMENT", "sandbox"),
		MTNBaseURL:           strings.TrimRight(env("MTN_BASE_URL", "https://sandbox.momodeveloper.mtn.com"), "/"),
		MTNSMSClientID:       env("MTN_SMS_CLIENT_ID", ""),
		MTNSMSClientSecret:   env("MTN_SMS_CLIENT_SECRET", ""),
		MTNSMSServiceCode:    env("MTN_SMS_SERVICE_CODE", ""),
		MTNSMSBaseURL:        strings.TrimRight(env("MTN_SMS_BASE_URL", "https://api.mtn.com/v3/sms"), "/"),
		MTNSMSTokenURL:       env("MTN_SMS_TOKEN_URL", "https://api.mtn.com/v1/oauth/access_token/accesstoken?grant_type=client_credentials"),
		TwilioAccountSID:     env("TWILIO_ACCOUNT_SID", ""),
		TwilioAuthToken:      env("TWILIO_AUTH_TOKEN", ""),
		TwilioFromNumber:     env("TWILIO_FROM_NUMBER", ""),
		OwnerSilverPrice:     envFloat("OWNER_SILVER_PRICE_RWF"),
		OwnerGoldPrice:       envFloat("OWNER_GOLD_PRICE_RWF"),
		OwnerPlatinumPrice:   envFloat("OWNER_PLATINUM_PRICE_RWF"),
	}
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

func envFloat(key string) float64 {
	value := env(key, "")
	amount, _ := strconv.ParseFloat(value, 64)
	return amount
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
