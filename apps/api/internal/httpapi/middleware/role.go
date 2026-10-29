package middleware

import (
	"net/http"

	"dapoersari-imsystem/apps/api/internal/auth"
	"dapoersari-imsystem/apps/api/internal/httpapi/respond"
)

// RequireRole allows the request only if the authenticated role is one of allowed.
// Must run after Auth so role is present in context.
func RequireRole(allowed ...string) func(http.Handler) http.Handler {
	set := make(map[string]struct{}, len(allowed))
	for _, r := range allowed {
		set[r] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := auth.RoleFromContext(r.Context())
			if !ok {
				respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
				return
			}
			if _, ok := set[role]; !ok {
				respond.Error(w, http.StatusForbidden, "akses ditolak untuk peran ini")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
