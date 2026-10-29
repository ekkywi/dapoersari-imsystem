// Command cleanlegacy drops golang-migrate bookkeeping left from early experiments.
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"dapoersari-imsystem/apps/api/internal/database"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, databaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	stmts := []string{
		`DROP TABLE IF EXISTS schema_migrations`,
		`DROP TABLE IF EXISTS users`,
		`DROP TYPE IF EXISTS user_role`,
	}

	for _, stmt := range stmts {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			log.Fatalf("exec %q: %v", stmt, err)
		}
		fmt.Println("ok:", stmt)
	}
}
