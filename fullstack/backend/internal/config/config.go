package config

import (
	"os"
	"strconv"
)

type Config struct {
	AppEnv             string
	Port               string
	DatabaseURL        string
	CorsOrigins        string
	MigrationsPath     string
	MediaUploadDir     string
	MediaPublicBaseURL string
	GoogleClientIDs    string
	OwnerSilverPrice   float64
	OwnerGoldPrice     float64
	OwnerPlatinumPrice float64
}

func Load() Config {
	return Config{
		AppEnv:             env("APP_ENV", "development"),
		Port:               env("PORT", "8080"),
		DatabaseURL:        env("DATABASE_URL", "postgres://umutungo:umutungo@localhost:5432/umutungo?sslmode=disable"),
		CorsOrigins:        env("CORS_ORIGINS", "http://localhost:3000"),
		MigrationsPath:     env("MIGRATIONS_PATH", "migrations"),
		MediaUploadDir:     env("MEDIA_UPLOAD_DIR", "storage/media"),
		MediaPublicBaseURL: env("MEDIA_PUBLIC_BASE_URL", ""),
		GoogleClientIDs:    env("GOOGLE_CLIENT_IDS", "947964372839-5mbve9eh4k07qpqkvm0h7cp35tm9rj8o.apps.googleusercontent.com"),
		OwnerSilverPrice:   envFloat("OWNER_SILVER_PRICE_RWF"),
		OwnerGoldPrice:     envFloat("OWNER_GOLD_PRICE_RWF"),
		OwnerPlatinumPrice: envFloat("OWNER_PLATINUM_PRICE_RWF"),
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
