# Product Roadmap

Context: academic deliverable with a real stakeholder demo. Foundations should be production-grade; feature depth is phased.

## Status snapshot

| Track | Status |
|-------|--------|
| **P0 — Core inventory** | **Delivered** in the current codebase |
| **P1 — Operational intelligence** | **Partially delivered** (thin alerts + in-transit in kitchen effective stock; config still defaults) |
| **P2 — Later** | Not started |

## P0 — Core inventory (required) — delivered

| Capability | Notes |
|------------|-------|
| Auth, users, roles | JWT Bearer; three roles; login rejects inactive users |
| Warehouse masters | Suppliers, categories, units, items, min stock |
| Dual stock | Warehouse + kitchen balances |
| Recipes | Kitchen-owned BOM per menu/paket |
| Stock request | By menu (expand + merge) and/or by item; snapshot lines |
| Approve / transfer / receive | Item units; kitchen stock increases on confirm |
| Menu closing | Shift/daily menu qty → ingredient usage |
| Opname | Per location; variance adjust + history + printable document |
| Printable BA | Stock request + warehouse stock-in (browser print; same pattern as opname) |
| History + activity log | Filters by location; deep-link to documents |
| Dashboard | Role-appropriate summaries from live counts |

## P1 — Operational intelligence (demo differentiator)

| Capability | Notes | Status |
|------------|-------|--------|
| Low-stock alerts | Based on `min_stock` + level (low/critical) | Delivered (thin) |
| In-transit awareness | Kitchen effective stock includes transferred-not-received | Delivered (thin) |
| Runtime config | Persist `lead_time_days`, `order_interval_days`, optional cutoff | Defaults only; admin UI later |
| Expiry field on stock-in | Optional input; alert can be thin | Field exists; alert not yet |
| Catalog maintenance | Update / soft-deactivate masters (items, suppliers, units, categories, menus) | Create+list today; update later |
| User administration | Super Admin: list/create/edit/soft-deactivate/reset password (no hard delete) | In progress (API core; routes + UI completing) |

## P2 — Later

| Capability | Notes |
|------------|-------|
| Reorder quantity suggestions | Usage × horizon + buffer |
| Strict FEFO | Requires durable batch balances |
| Admin UI for schedules | Shift definitions, cutoff editors |
| Recipe vs opname variance reports | Continuous improvement of BOM accuracy |
| Barcode / IoT | Explicitly later |

## Capability dependency (product view)

```text
Identity & access
  → Catalog & warehouse stock
  → Recipes
  → Request / transfer / receive
  → Menu closing & opname
  → History & dashboard
  → Alerts & operational config
```

## Stakeholder communication

Operational hours and request cutoffs remain **tunable**. Demo scenarios may use example lead/interval defaults without claiming they match final restaurant policy.
