package middleware

import (
	"net/http"
	"strings"

	"dapoersari-imsystem/apps/api/internal/auth"
	"dapoersari-imsystem/apps/api/internal/httpapi/respond"
)

// CORS restricts browser access to the configured frontend origin.
func CORS(allowedOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Max-Age", "86400")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Auth middleware for authentication and authorization checks
func Auth(svc *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" || !strings.HasPrefix(header, "Bearer ") {
				respond.Error(w, http.StatusUnauthorized, "missing or invalid authorization header")
				return
			}

			token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
			userID, role, err := svc.ParseToken(token)
			if err != nil {
				respond.Error(w, http.StatusUnauthorized, "invalid token")
				return
			}

			user, err := svc.Me(r.Context(), userID)
			if err != nil || !user.IsActive {
				respond.Error(w, http.StatusUnauthorized, "invalid token")
				return
			}
			role = user.Role

			ctx := auth.ContextWithUser(r.Context(), userID, role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
