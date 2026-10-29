package httpapi

import (
	"net/http"
	"time"

	"dapoersari-imsystem/apps/api/internal/auth"
	"dapoersari-imsystem/apps/api/internal/httpapi/middleware"
	"dapoersari-imsystem/apps/api/internal/httpapi/respond"
)

// NewRouter builds the HTTP mux for the API.
func NewRouter(corsOrigin string, authHandler *auth.Handler, authSvc *auth.Service) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		respond.JSON(w, http.StatusOK, map[string]any{
			"status":    "ok",
			"service":   "dapoersari-api",
			"time":      time.Now().UTC().Format(time.RFC3339),
			"apiPrefix": "/api/v1",
		})
	})

	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		respond.JSON(w, http.StatusOK, map[string]string{
			"status": "ok",
		})
	})

	// Auth Routes
	mux.HandleFunc("POST /api/v1/auth/login", authHandler.Login)
	mux.Handle("GET /api/v1/auth/me", middleware.Auth(authSvc)(http.HandlerFunc(authHandler.Me)))

	return middleware.CORS(corsOrigin)(mux)
}
