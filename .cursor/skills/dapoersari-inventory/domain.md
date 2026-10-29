# Domain reference

UI labels use Indonesian (e.g. Admin Dapur for `admin_kitchen`). Role codes in DB/API stay English snake_case.

## Actors

| Role code | UI label | Responsibility |
|-----------|----------|----------------|
| `super_admin` | Super Admin | Full access, user management |
| `admin_gudang` | Admin Gudang | Suppliers, items, stock-in, approve/transfer, warehouse opname |
| `admin_kitchen` | Admin Dapur | Recipes, requests, receive, menu closing/usage, kitchen opname |

Shared UIs may use `?focus=warehouse|kitchen`; mutation buttons follow door + role.

## Warehouse catalog (persisted)

Units, categories, suppliers, items (`min_stock`), and `warehouse_stocks` (one row per item; created at qty 0 with the item). Kitchen stock row also initialized at item create. Direct qty edits are forbidden — use stock-in / transfer / closing / opname / etc.

## Stock movement rules

| Event | Warehouse stock | Kitchen stock |
|-------|-----------------|---------------|
| Stock-in from supplier | + | — |
| Transfer processed | − | — |
| Receive confirmed | — | + |
| Menu closing (recipe explode) | — | − per ingredient |
| Manual waste (optional) | — / − | − |
| Opname confirmed | adjust | adjust |

## Request document shape

Always expose both layers in UI and printable output:

1. **Package summary** — menu × qty paket  
2. **Item detail** — merged ingredient lines (unit qty), optional provenance notes in storage  

## Opname document shape

1. Meta — location, status, timestamps, note  
2. Lines — system / physical / variance  
3. Printable berita acara focused on non-zero variance  

## Recipe rules

- Recipes reference existing catalog `item_id` + warehouse unit.
- Block menu-closing / by-menu request if recipe empty.
- Kitchen cannot invent catalog items; Admin Gudang / Super Admin creates items first.

## Smart layer (rules)

```text
warehouse: effective = on_hand
kitchen:   effective = on_hand + in_transit (status transferred)
alert if effective <= min_stock
level critical if effective <= 0 or <= 0.5 * min_stock
demo defaults: lead_time_days=3, order_interval_days=7
reorder hint (later) ≈ avg_daily_usage × (order_interval_days + lead_time_days) + buffer − effective
```

Operational hours and request cutoff are configuration values for later tuning — never hardcode restaurant hours.
