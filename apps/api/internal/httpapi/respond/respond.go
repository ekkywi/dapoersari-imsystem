package respond

import (
	"encoding/json"
	"net/http"
)

type envelope struct {
	Data    any    `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
	Code    string `json:"code,omitempty"`
	Details any    `json:"details,omitempty"`
}

// JSON writes a successful JSON response.
func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{Data: data})
}

// Error writes a JSON error response.
func Error(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{Error: message})
}

// ErrorWithDetails writes a JSON error response with an optional machine code
// and structured details. `error` stays a plain string for older clients.
func ErrorWithDetails(w http.ResponseWriter, status int, message, code string, details any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{Error: message, Code: code, Details: details})
}
