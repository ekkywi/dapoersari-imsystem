package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"dapoersari-imsystem/apps/api/internal/httpapi/respond"
)

const (
	loginWindow      = 15 * time.Minute
	loginMaxPerIP    = 20
	loginMaxPerEmail = 8
)

type loginAttemptBucket struct {
	count   int
	resetAt time.Time
}

// LoginRateLimiter limits POST /auth/login by client IP and email (in-memory).
// Suitable for a single API instance (e.g. one Render dyno).
type LoginRateLimiter struct {
	mu     sync.Mutex
	byIP   map[string]*loginAttemptBucket
	byMail map[string]*loginAttemptBucket
}

func NewLoginRateLimiter() *LoginRateLimiter {
	return &LoginRateLimiter{
		byIP:   make(map[string]*loginAttemptBucket),
		byMail: make(map[string]*loginAttemptBucket),
	}
}

func (l *LoginRateLimiter) allow(store map[string]*loginAttemptBucket, key string, max int) bool {
	now := time.Now()
	b, ok := store[key]
	if !ok || now.After(b.resetAt) {
		store[key] = &loginAttemptBucket{count: 1, resetAt: now.Add(loginWindow)}
		return true
	}
	if b.count >= max {
		return false
	}
	b.count++
	return true
}

func (l *LoginRateLimiter) Allow(ip, email string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	if ip != "" && !l.allow(l.byIP, ip, loginMaxPerIP) {
		return false
	}
	email = strings.ToLower(strings.TrimSpace(email))
	if email != "" && !l.allow(l.byMail, email, loginMaxPerEmail) {
		return false
	}
	return true
}

// LoginRateLimit wraps the login handler.
func LoginRateLimit(limiter *LoginRateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)

			var email string
			if r.Body != nil {
				raw, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
				_ = r.Body.Close()
				if err == nil {
					r.Body = io.NopCloser(bytes.NewReader(raw))
					var body struct {
						Email string `json:"email"`
					}
					_ = json.Unmarshal(raw, &body)
					email = body.Email
				} else {
					r.Body = io.NopCloser(bytes.NewReader(nil))
				}
			}

			if !limiter.Allow(ip, email) {
				respond.Error(w, http.StatusTooManyRequests, "terlalu banyak percobaan masuk; coba lagi nanti")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
