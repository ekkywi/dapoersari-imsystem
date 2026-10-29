# Product Roadmap

Context: academic deliverable with a real stakeholder demo. Foundations should be production-grade; feature depth is phased.

## P0 — Core inventory (required)

| Capability | Notes |
|------------|-------|
| Auth, users, roles | JWT Bearer; activate/deactivate users |
| Warehouse masters | Suppliers, categories, units, items, min stock |
| Dual stock | Warehouse + kitchen balances |
| Recipes | Kitchen-owned BOM per menu/paket |
| Stock request | By menu (expand + merge) and/or by item; snapshot lines |
| Approve / transfer / receive | Item units; kitchen stock increases on confirm |
| Menu closing | Shift/daily menu qty → ingredient usage |
| Opname | Per location; variance adjust + history |
| History + activity log | Filters by period/item/type; logs append-only |
| Dashboard | Role-appropriate summaries |

## P1 — Operational intelligence (demo differentiator)

| Capability | Notes |
|------------|-------|
| Low-stock alerts | Based on `min_stock` |
| In-transit awareness | Avoid double-ordering |
| Runtime config | `lead_time_days`, `order_interval_days`, optional cutoff |
| Expiry field on stock-in | Optional input; alert can be thin in P1 |

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

Operational hours and request cutoffs remain **tunable**. Demo scenarios may use example schedules without claiming they match final restaurant policy.
