package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/umutungo/umutungo/backend/internal/config"
	"github.com/umutungo/umutungo/backend/internal/db"
	"github.com/umutungo/umutungo/backend/internal/httpapi"
)

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect to postgres: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool, cfg.MigrationsPath); err != nil {
		log.Fatalf("run database migrations: %v", err)
	}

	api := httpapi.New(pool, cfg)
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           api.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("Umutungo API listening on :%s", cfg.Port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server stopped: %v", err)
	}
}
