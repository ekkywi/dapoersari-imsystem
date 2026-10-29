# API (`apps/api`)

Idiomatic Go HTTP service for SI Inventory Rumah Makan.

## Run

```bash
cp .env.example .env   # then edit
# from repo root:
make api
```

Health: `GET /health` and `GET /api/v1/health`

## Migrations (goose)

```bash
# from repo root (loads apps/api/.env)
make migrate-status
make migrate-up
make migrate-down
```

If an early `golang-migrate` experiment left `schema_migrations` behind:

```bash
make migrate-reset-legacy
```

## Layout

See repository `docs/ARCHITECTURE.md`. Domain packages under `internal/` are filled per roadmap.
