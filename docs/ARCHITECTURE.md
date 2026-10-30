# Architecture

## Overview

```text
Browser
   │
   ▼
Next.js  (apps/web)     ─── deploy: Vercel
   │  HTTPS + JWT Bearer
   ▼
Go API   (apps/api)     ─── deploy: Railway / Render
   │
   ▼
Neon Postgres
```

The repository is a **monorepo**. Separate deploy targets are expected and supported:

| Component | Host | Root directory |
|-----------|------|----------------|
| Web | Vercel | `apps/web` |
| API | Railway or Render | `apps/api` |
| Database | Neon | managed Postgres |

## Monorepo layout

```text
dapoersari-imsystem/
├── apps/
│   ├── api/                 # Go HTTP API
│   └── web/                 # Next.js App Router
├── docs/                    # Product / system documentation
├── .cursor/skills/          # Cursor agent skills (tooling)
├── Makefile
├── .env.example
└── README.md
```

### Backend (`apps/api`)

```text
cmd/api/main.go              # process entry; dependency wiring only
internal/
  config/                    # environment loading
  database/                  # Neon / pgx pool
  httpapi/                   # router, middleware, JSON helpers
  auth/
  warehouse/
  transfer/
  kitchen/                   # recipes, kitchen stock, menu closing
  opname/
  history/
  activity/
  dashboard/                 # summary + low-stock alerts (rules)
migrations/                  # versioned SQL (goose)
```

Package boundaries follow **domain packages**. Each domain typically exposes handler, service, repository, and model surfaces.

### Frontend (`apps/web`)

```text
src/app/(auth)/              # authentication screens
src/app/(dashboard)/app/     # authenticated operator shell (/app)
src/components/ui/           # shared UI primitives
src/components/features/     # shell: AuthGate, AppSidebar, …
src/lib/                     # API clients, session, RBAC helpers
```

Primary operator routes live under `/app` (overview, warehouse, kitchen, stock-requests, opnames, alerts, history). Navigation is role-filtered; some shared screens use `?focus=warehouse|kitchen` so Super Admin sees the correct actions per entry door.

## Cross-origin configuration

Web and API are hosted on different origins in production:

| Variable | Owner | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_API_URL` | Web | Base URL of the Go API |
| `CORS_ORIGIN` | API | Allowed browser origin |
| `DATABASE_URL` | API | Neon connection string |
| `JWT_SECRET` | API | JWT signing secret |

The API must answer CORS preflight (`OPTIONS`) for browser clients.

## Authentication model

Split hosting uses **JWT in `Authorization: Bearer`**. Cookie-based sessions across different parent domains are intentionally avoided in v1.

Public health endpoints exist for liveness. Login issues a JWT; protected routes (including “current user”) require a valid Bearer token. The API is the source of truth for authorization; the UI mirrors session state for navigation only.

API JSON uses a consistent envelope: success payload under `data`, failures under `error`.

## Data domains (high level)

| Domain | Responsibility |
|--------|----------------|
| Auth / users | Identity, roles, JWT session |
| Warehouse | Units, categories, suppliers, items, warehouse on-hand, stock-in |
| Kitchen | Recipes/menus, kitchen on-hand, menu closing (usage) |
| Transfer | Stock requests: create → approve/reject → transfer → receive |
| Opname | Physical count vs system; confirm adjusts stock + documents variance |
| History / activity | Stock ledger and append-only activity log |
| Dashboard | Role-facing summary counts; rules-based low-stock alerts |

Warehouse catalog and warehouse on-hand are first-class persisted concepts. Stock quantities change only through transactional movements defined in the domain model.

## Product UI characteristics

- Operator-facing copy is Indonesian (inventory management wording).
- Visual direction: calm navy hospitality / instrument panel — operational, not marketing SaaS.
- Unauthenticated landing may expose non-sensitive status only; stock and reports require login.
- Light/dark theme is supported for the operator shell.
- Printable berita acara documents: opname, stock request (warehouse↔kitchen), and warehouse stock-in.

## Runtime constraints

- The API listens on `0.0.0.0:$PORT` in hosted environments.
- Stock mutations run inside database transactions.
- Free-tier platform limits are operational concerns, not application domain rules.
