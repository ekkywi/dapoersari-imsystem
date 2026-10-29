package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds process configuration loaded from the environment.
type Config struct {
	AppEnv       string
	Port         string
	DatabaseURL  string
	JWTSecret    string
	CORSOrigin   string
	LeadTimeDays int
	OrderIntervalDays int
}

// Load reads configuration from environment variables.
// DATABASE_URL and JWT_SECRET may be empty during early scaffolding (health-only).
func Load() (Config, error) {
	cfg := Config{
		AppEnv:            getEnv("APP_ENV", "development"),
		Port:              getEnv("PORT", "8080"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		JWTSecret:         os.Getenv("JWT_SECRET"),
		CORSOrigin:        getEnv("CORS_ORIGIN", "http://localhost:3000"),
		LeadTimeDays:      getEnvInt("LEAD_TIME_DAYS", 1),
		OrderIntervalDays: getEnvInt("ORDER_INTERVAL_DAYS", 1),
	}

	if cfg.Port == "" {
		return Config{}, fmt.Errorf("PORT must not be empty")
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}

	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
