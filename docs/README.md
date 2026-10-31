# Documentation Index

Product and system documentation for **SI Inventory Rumah Makan** (`dapoersari-imsystem`).

These documents describe **what the application is** — scope, architecture, domain rules, and planned capabilities. They are not a personal development diary or coding tutorial.

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System topology, deploy targets, monorepo layout, auth model |
| [DOMAIN.md](./DOMAIN.md) | Business rules, stock flows, recipe bridge, alerts |
| [ROADMAP.md](./ROADMAP.md) | Phased product capabilities (P0–P2) and delivery status |

## Scope statement

This repository implements a dual-location inventory system (Warehouse ↔ Kitchen). Customer POS, cashier flows, and accounting are **out of scope**. Smart capabilities are **rules-based** (alerts, reorder hints)—not ML/AI.

## Current product surface (operator)

| Area | Highlights |
|------|------------|
| Gudang | Masters (edit + soft nonaktif item/pemasok), persediaan, stok masuk, antrian, opname |
| Dapur | Resep/menu, persediaan dapur, permintaan, akhir shift, opname |
| Audit | Riwayat mutasi + aktivitas; BA opname, permintaan, stok masuk (cetak browser) |
| Administrasi | Super Admin: kelola pengguna (buat, edit, nonaktif, reset sandi) |
| Operasional | Ringkasan angka; peringatan persediaan (min-stock, in-transit dapur); kategori di stok/alert/BA |

## Applications

| App | Role |
|-----|------|
| `apps/web` | Operator UI (Next.js) |
| `apps/api` | HTTP API (Go) |

## Owner-only notes

Personal coding notes, progress checklists, and machine-handoff prompts live under `docs/private/` (gitignored) and are **not** part of the published documentation set.
