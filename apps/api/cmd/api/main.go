package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"dapoersari-imsystem/apps/api/internal/activity"
	"dapoersari-imsystem/apps/api/internal/auth"
	"dapoersari-imsystem/apps/api/internal/config"
	"dapoersari-imsystem/apps/api/internal/dashboard"
	"dapoersari-imsystem/apps/api/internal/database"
	"dapoersari-imsystem/apps/api/internal/history"
	"dapoersari-imsystem/apps/api/internal/httpapi"
	"dapoersari-imsystem/apps/api/internal/kitchen"
	"dapoersari-imsystem/apps/api/internal/opname"
	"dapoersari-imsystem/apps/api/internal/transfer"
	"dapoersari-imsystem/apps/api/internal/warehouse"
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

	authRepo := auth.NewRepository(db)
	authSvc := auth.NewService(authRepo, cfg.JWTSecret, cfg.JWTTTL)
	authHandler := auth.NewHandler(authSvc)

	warehouseRepo := warehouse.NewRepository(db)
	warehouseSvc := warehouse.NewService(warehouseRepo)
	warehouseHandler := warehouse.NewHandler(warehouseSvc)

	kitchenRepo := kitchen.NewRepository(db)
	kitchenSvc := kitchen.NewService(kitchenRepo)
	kitchenHandler := kitchen.NewHandler(kitchenSvc)

	transferRepo := transfer.NewRepository(db)
	transferSvc := transfer.NewService(transferRepo, kitchenSvc)
	transferHandler := transfer.NewHandler(transferSvc)

	opnameRepo := opname.NewRepository(db)
	opnameSvc := opname.NewService(opnameRepo)
	opnameHandler := opname.NewHandler(opnameSvc)

	historyRepo := history.NewRepository(db)
	historySvc := history.NewService(historyRepo)
	historyHandler := history.NewHandler(historySvc)

	activityRepo := activity.NewRepository(db)
	activitySvc := activity.NewService(activityRepo)
	activityHandler := activity.NewHandler(activitySvc)

	dashboardRepo := dashboard.NewRepository(db)
	dashboardSvc := dashboard.NewService(dashboardRepo)
	dashboardHandler := dashboard.NewHandler(dashboardSvc)

	handler := httpapi.NewRouter(
		cfg.CORSOrigin,
		authHandler,
		authSvc,
		warehouseHandler,
		kitchenHandler,
		transferHandler,
		opnameHandler,
		historyHandler,
		activityHandler,
		dashboardHandler,
	)

	addr := "0.0.0.0:" + cfg.Port
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("api listening on %s (env=%s cors=%s jwt_ttl=%s)", addr, cfg.AppEnv, cfg.CORSOrigin, cfg.JWTTTL)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server: %v", err)
	}
}
