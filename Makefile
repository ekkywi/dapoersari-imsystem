.PHONY: api web tidy build-api health migrate-up migrate-down migrate-status migrate-reset-legacy help

help:
	@echo "Targets:"
	@echo "  make api                 - run Go API on :8080"
	@echo "  make web                 - run Next.js on :3000"
	@echo "  make tidy                - go mod tidy"
	@echo "  make build-api           - compile API binary to apps/api/bin/api"
	@echo "  make health              - curl local /health"
	@echo "  make migrate-up          - goose up"
	@echo "  make migrate-down        - goose down one step"
	@echo "  make migrate-status      - goose status"
	@echo "  make migrate-reset-legacy - drop golang-migrate leftovers, then goose up"

api:
	cd apps/api && \
	  if [ -f .env ]; then set -a && . ./.env && set +a; fi && \
	  go run ./cmd/api

web:
	cd apps/web && npm run dev

tidy:
	cd apps/api && go mod tidy

build-api:
	mkdir -p apps/api/bin
	cd apps/api && go build -o bin/api ./cmd/api

health:
	curl -sS http://127.0.0.1:8080/health | python3 -m json.tool

migrate-up:
	export PATH="$$HOME/go/bin:$$PATH"; \
	set -a && [ -f apps/api/.env ] && . ./apps/api/.env; set +a; \
	goose -dir apps/api/migrations postgres "$$DATABASE_URL" up

migrate-down:
	export PATH="$$HOME/go/bin:$$PATH"; \
	set -a && [ -f apps/api/.env ] && . ./apps/api/.env; set +a; \
	goose -dir apps/api/migrations postgres "$$DATABASE_URL" down

migrate-status:
	export PATH="$$HOME/go/bin:$$PATH"; \
	set -a && [ -f apps/api/.env ] && . ./apps/api/.env; set +a; \
	goose -dir apps/api/migrations postgres "$$DATABASE_URL" status

migrate-reset-legacy:
	export PATH="$$HOME/go/bin:$$PATH"; \
	set -a && [ -f apps/api/.env ] && . ./apps/api/.env; set +a; \
	cd apps/api && go run ./cmd/cleanlegacy && cd ../.. && \
	goose -dir apps/api/migrations postgres "$$DATABASE_URL" up && \
	goose -dir apps/api/migrations postgres "$$DATABASE_URL" status
