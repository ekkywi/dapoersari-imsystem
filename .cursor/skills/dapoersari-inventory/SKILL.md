---
name: dapoersari-inventory
description: >-
  Guides implementation of SI Inventory Rumah Makan (Dapoer Sari): Next.js + Go + Neon
  monorepo, recipe/BOM bridge, dual-location stock, shift menu usage, opname, and
  rules-based smart alerts. Use when coding, scaffolding, reviewing, designing, or
  resuming work for dapoersari-imsystem, warehouse/kitchen inventory, stock transfer,
  resep/menu paket, or smart reorder without AI.
---

# Dapoer Sari Inventory

College demo with a real user. Keep production-grade foundations; keep scope phased.

## Documentation split (important)

| Location | Purpose | In git? |
|----------|---------|---------|
| `docs/ARCHITECTURE.md`, `DOMAIN.md`, `ROADMAP.md` | Describe the **application** | Yes |
| `docs/private/*` | Owner develop notes: STATUS, HANDOFF, conventions, decisions | **No** (gitignored) |

Never put personal progress, machine-handoff prompts, or “how I code today” into public `docs/`.  
If `docs/private/` is missing on this machine, ask the user to restore it (USB/cloud) before assuming stage progress.

## First read

1. If present: `docs/private/STATUS.md`, `HANDOFF.md`, `CONVENTIONS.md`, `DECISIONS.md`, `CODING-GUIDE.md`
2. Public app docs: `docs/ARCHITECTURE.md`, `docs/DOMAIN.md`, `docs/ROADMAP.md`
3. This skill + [domain.md](domain.md)

## Locked stack

| Layer | Choice |
|-------|--------|
| Repo | Monorepo `apps/web` + `apps/api` |
| Frontend | Next.js (App Router) → Vercel |
| Backend | Idiomatic Go (not Nest-style DI) → Railway/Render |
| DB | Neon Postgres |
| Migrations | **goose** only — not golang-migrate |

## Progress

Trust `docs/private/STATUS.md` when available. **Tahap 0–5 done** (migrations through `00005`). BA print (opname / permintaan / stok masuk) + category on stocks/alerts/BA delivered. **Next resume:** finish **Admin Pengguna** (router + FE page; see STATUS), then soft CRUD masters / config / deploy. Do not re-scaffold tahap 0–5 or remake migrations `00002`–`00005`.

## Folder layout (do not invent Nest modules)

```text
apps/api/
  cmd/api/main.go
  internal/{config,database,httpapi,auth,warehouse,transfer,kitchen,opname,history,activity}
  migrations/

apps/web/src/
  app/(auth)/ app/(dashboard)/
  components/{ui,features}/ lib/ types/
```

Per Go domain: `handler.go`, `service.go`, `repository.go`, `model.go`. Wire in `main`.

## Domain invariants

1. **No direct stock edits** — mutations via transactions only.
2. **Kitchen speaks menus; warehouse speaks item+unit** — kitchen owns recipes.
3. **1 menu = 1 paket** — expand + merge identical items; snapshot lines.
4. **Receive / transfer / stock / opname = item units only**.
5. **Persist snapshots** — do not re-explode from live recipe later.
6. **Shift closing** — menu qty → ingredient usage (no POS).
7. **Opname corrects drift** — does not replace daily usage.
8. **Smart = rules, not AI** — configurable lead time / interval / cutoff; no hardcoded restaurant hours.
9. **RBAC** — Super Admin, Admin Gudang, Admin Kitchen.
10. **Activity logs** — append-only via app APIs.

## UI / FE invariants

1. User-facing copy: **Indonesian**. Identifiers/API fields: English.
2. Navy hospitality / instrument — not marketing SaaS / purple gradients.
3. Public pre-login: non-sensitive metrics only.
4. Theme: `data-theme` + `ds_theme`. Time: `HH:MM:SS` with `:`.

## Auth already present

- `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, JWT middleware
- FE session + AuthGate + landing
- Envelope `{ data }` / `{ error }`

## Build priority

- **P0:** auth, catalog+dual stock, recipes, request/transfer/receive, closing, opname, history, dashboard
- **P1:** min-stock alerts, in-transit, config, optional ED
- **P2:** richer reorder / FEFO / schedule admin (document first)

## Agent behavior

- Idiomatic Go; no Nest mirrors.
- Guide step-by-step when the user codes manually.
- Small demo data; end-to-end flows.
- Never commit `docs/private/` or `.env`.
- Do not add develop diaries / handoff prompts under public `docs/`.

## Additional resources

- [domain.md](domain.md)
- Public app docs: `docs/README.md`
- Private progress/prompt: `docs/private/STATUS.md`, `docs/private/HANDOFF.md`
