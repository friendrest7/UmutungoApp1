package config

import "os"

type Config struct {
	AppEnv             string
	Port               string
	DatabaseURL        string
	CorsOrigins        string
	MigrationsPath     string
	MediaUploadDir     string
	MediaPublicBaseURL string
	GoogleClientIDs    string
}

func Load() Config {
	return Config{
		AppEnv:             env("APP_ENV", "development"),
		Port:               env("PORT", "8080"),
		DatabaseURL:        env("DATABASE_URL", "postgres://umutungo:umutungo@localhost:5432/umutungo?sslmode=disable"),
		CorsOrigins:        env("CORS_ORIGINS", "http://localhost:3000"),
		MigrationsPath:     env("MIGRATIONS_PATH", "migrations/001_init.sql"),
		MediaUploadDir:     env("MEDIA_UPLOAD_DIR", "storage/media"),
		MediaPublicBaseURL: env("MEDIA_PUBLIC_BASE_URL", ""),
		GoogleClientIDs:    env("GOOGLE_CLIENT_IDS", ""),
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
