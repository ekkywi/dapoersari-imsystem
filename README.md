# SI Inventory Rumah Makan (Dapoer Sari)

Dual-location inventory system (Warehouse ↔ Kitchen) for restaurant operations.

**Stack:** Next.js (web) · Go (API) · Neon (Postgres)

## What it is

Operators manage ingredients across **gudang** and **dapur**, request stock via recipes/menus, transfer and receive in item units, close shifts without a POS, correct drift with opname (printable variance document), and review audit history. “Smart” behavior is rules-based (low-stock alerts with kitchen in-transit awareness)—not ML/AI.

Customer POS, cashier, and accounting are out of scope. See [docs/ROADMAP.md](./docs/ROADMAP.md) for delivered vs planned capabilities.

## Documentation

Product / system docs (what the application is):

- [docs/README.md](./docs/README.md)
- [Architecture](./docs/ARCHITECTURE.md) · [Domain](./docs/DOMAIN.md) · [Roadmap](./docs/ROADMAP.md)

## Repository layout

```text
apps/api   Go HTTP API          → Railway / Render
apps/web   Next.js App Router   → Vercel
docs/      Product & system documentation
```

## Run locally

Prerequisites: Go 1.22+, Node 20+/npm, Neon project (for data features).

```bash
cp apps/api/.env.example apps/api/.env          # set DATABASE_URL, JWT_SECRET, CORS_ORIGIN
cp apps/web/.env.example apps/web/.env.local    # NEXT_PUBLIC_API_URL

make api    # http://localhost:8080
make web    # http://localhost:3000
make health
```

Migrations use [goose](https://github.com/pressly/goose) (`make migrate-up`, `migrate-status`, …). Quote `DATABASE_URL` when it contains `&`.

No Docker Compose in v1 — the database is Neon.
