# Domain Model

## Purpose

Manage ingredient inventory across **Warehouse** and **Kitchen**, with auditable stock movements. Kitchen planning language is **menu/paket**; warehouse execution language is **item + unit**.

## Roles

| Role | Capabilities |
|------|----------------|
| Super Admin | Full access; user administration |
| Admin Gudang | Suppliers, catalog items, stock-in, approve/transfer, warehouse opname |
| Admin Kitchen | Recipes, stock requests, receive confirmation, menu closing / usage, kitchen opname |

## Core concepts

### Warehouse catalog

Operational masters that define what can be stocked and ordered:

| Concept | Role |
|---------|------|
| Unit | Canonical measure for an item (e.g. kg, liter, pcs) |
| Category | Optional grouping for catalog items |
| Supplier | Source for stock-in |
| Item | Material master: SKU, name, unit, optional category, `min_stock` |
| Warehouse stock | On-hand quantity at the warehouse per item |

Creating a catalog item initializes warehouse on-hand at zero. Quantity increases only through stock movements (e.g. supplier stock-in), never by editing the balance field directly.

Kitchen on-hand is a separate balance (dual-location); it is introduced with transfer/receive flows.

### Catalog item

Master material with a canonical unit, optional minimum stock, and dual on-hand balances (warehouse / kitchen).

### Recipe (BOM)

Owned by Kitchen. Maps `menu → [(item_id, qty_per_paket)]` using catalog units only. Warehouse does not maintain recipes. Catalog items must exist before they appear in a recipe.

### Stock request

May originate as:

- `by_menu` — menus × paket quantities, expanded through recipes; **identical items are merged** into warehouse lines
- `by_item` — direct ingredient lines (escape hatch)

Persisted shape always includes:

1. Package summary (menus × qty) when applicable  
2. Final item lines (merged) used for approval, picking, transfer, and receive  

Expanded lines are **snapshotted** at submit time.

### Transfer & receive

Physical movement is always in item units. Kitchen receive confirmation increases kitchen stock per item. Package quantity is contextual metadata, not a stock UoM.

### Menu closing (usage without POS)

Per shift or per day, Kitchen submits menus produced/sold. The system explodes recipes, snapshots usage lines, and decreases kitchen stock per item. This is the primary outbound path for kitchen stock. It is not a POS.

### Opname

Physical count vs system quantity per item (and location). Confirmed variance adjusts stock and writes history. Opname **corrects** drift; it does not replace routine usage posting.

### History & activity

Every stock delta writes stock history. User actions write append-only activity logs (not editable/deletable through normal application APIs).

## Stock movement matrix

| Event | Warehouse | Kitchen |
|-------|-----------|---------|
| Supplier stock-in | + | — |
| Transfer dispatched | − | — |
| Receive confirmed | — | + |
| Menu closing (recipe) | — | − |
| Opname confirmed | ± | ± |

## Document / UI contract

Screens and printable documents for a request must show:

1. **Package summary** — each menu and paket quantity  
2. **Item detail** — merged ingredient requirements with units  

## Smart inventory (non-AI)

Rules operate on persisted transactions:

- Low-stock alert when on-hand (and optionally in-transit policy) ≤ `min_stock`
- Optional expiry awareness when stock-in records `expired_at` / batch data
- Reorder hints from average usage × (`order_interval_days` + `lead_time_days`) + buffer

Operational schedules (shift hours, request cutoff) are **configuration**, not hardcoded business constants.

## Explicit non-goals (v1)

- Customer ordering / POS / payments  
- Full accounting  
- ML forecasting  
- Mandatory FEFO enforcement (roadmap)
