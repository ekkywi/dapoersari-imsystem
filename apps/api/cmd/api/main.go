package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"dapoersari-imsystem/apps/api/internal/auth"
	"dapoersari-imsystem/apps/api/internal/config"
	"dapoersari-imsystem/apps/api/internal/database"
	"dapoersari-imsystem/apps/api/internal/httpapi"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()
	log.Printf("database: connected")

	repo := auth.NewRepository(db)
	svc := auth.NewService(repo, cfg.JWTSecret)
	h := auth.NewHandler(svc)
	handler := httpapi.NewRouter(cfg.CORSOrigin, h, svc)

	addr := "0.0.0.0:" + cfg.Port
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("api listening on %s (env=%s cors=%s)", addr, cfg.AppEnv, cfg.CORSOrigin)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server: %v", err)
	}
}
