"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationSwitch } from "@/components/ui/LocationSwitch";
import { MinGauge } from "@/components/ui/MinGauge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Qty } from "@/components/ui/Qty";
import { StatusChip } from "@/components/ui/StatusChip";
import { FilterChips } from "@/components/ui/Tabs";
import { getUser } from "@/lib/auth";
import { kitchenApi } from "@/lib/kitchen";
import { canMutateKitchen, canMutateWarehouse, navKeysForRole } from "@/lib/rbac";
import { round3 } from "@/lib/request-stock";
import { stockLevel, type StockLevel } from "@/lib/stock-level";
import { transferApi } from "@/lib/transfer";
import { warehouseApi } from "@/lib/warehouse";

type Location = "warehouse" | "kitchen";
type Filter = "all" | "need" | "ok";

type Row = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  active: boolean;
  qty: number;
  transit: number;
  min: number;
  level: StockLevel;
  /** effective ÷ min, for ordering the most urgent first. Items without a minimum sort last. */
  ratio: number;
};

const RANK: Record<StockLevel, number> = { critical: 0, low: 1, ok: 2 };

export function StockTable({ location }: { location: Location }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transitError, setTransitError] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const kitchen = location === "kitchen";

  const load = useCallback(async () => {
    setLoadError(null);
    setTransitError(false);
    try {
      const [items, cats, units, stocks] = await Promise.all([
        warehouseApi.listItems(),
        warehouseApi.listCategories(),
        warehouseApi.listUnits(),
        kitchen ? kitchenApi.listStocks() : warehouseApi.listStocks(),
      ]);

      // Kitchen status counts goods the warehouse already sent but the kitchen has not confirmed.
      // TODO(api): in-transit per item would need one GET per transferred request until the list carries lines.
      const transit = new Map<string, number>();
      if (kitchen) {
        try {
          const sent = (await transferApi.list()).filter((r) => r.status === "transferred");
          const details = await Promise.all(sent.map((r) => transferApi.get(r.id)));
          for (const d of details) {
            for (const l of d.lines ?? []) {
              transit.set(l.item_id, round3((transit.get(l.item_id) ?? 0) + l.qty));
            }
          }
        } catch {
          setTransitError(true);
        }
      }

      const unitCode = new Map(units.map((u) => [u.id, u.code]));
      const catName = new Map(cats.map((c) => [c.id, c.name]));
      const qtyOf = new Map(stocks.map((s) => [s.item_id, s.qty]));

      const next: Row[] = [];
      for (const it of items) {
        const qty = qtyOf.get(it.id) ?? 0;
        // An inactive item stays listed only while it still holds stock.
        if (!it.is_active && qty <= 0) continue;
        const inTransit = transit.get(it.id) ?? 0;
        const effective = qty + inTransit;
        next.push({
          id: it.id,
          sku: it.sku,
          name: it.name,
          category: it.category_id ? (catName.get(it.category_id) ?? null) : null,
          unit: unitCode.get(it.unit_id) ?? "",
          active: it.is_active,
          qty,
          transit: inTransit,
          min: it.min_stock,
          level: stockLevel(effective, it.min_stock),
          ratio: it.min_stock > 0 ? effective / it.min_stock : Number.POSITIVE_INFINITY,
        });
      }
      next.sort(
        (a, b) =>
          RANK[a.level] - RANK[b.level] ||
          a.ratio - b.ratio ||
          a.name.localeCompare(b.name, "id"),
      );
      setRows(next);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat persediaan");
    } finally {
      setLoading(false);
    }
  }, [kitchen]);

  useEffect(() => {
    const user = getUser();
    setRole(user?.role ?? null);
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const need = rows.filter((r) => r.level !== "ok").length;
    return { all: rows.length, need, ok: rows.length - need };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "need" && r.level === "ok") return false;
      if (filter === "ok" && r.level !== "ok") return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        (r.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query]);

  const keys = role ? navKeysForRole(role) : null;
  const cta =
    role && !kitchen && canMutateWarehouse(role) ? (
      <LinkButton href="/app/warehouse/stock-ins">Catat persediaan masuk</LinkButton>
    ) : role && kitchen && canMutateKitchen(role) ? (
      <LinkButton href="/app/stock-requests/new?focus=kitchen">Ajukan permintaan</LinkButton>
    ) : null;

  return (
    <div className="ds-screen">
      <PageHeader
        title="Persediaan"
        lede="Saldo per item. Garis tipis di bar adalah batas minimum."
        actions={
          <>
            <LocationSwitch
              current={location}
              show={{
                warehouse: keys ? keys.has("stocks") : true,
                kitchen: keys ? keys.has("kitchen-stocks") : true,
              }}
            />
            {cta}
          </>
        }
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Persediaan belum bisa dimuat"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Coba lagi
            </Button>
          }
        >
          {loadError}. Periksa koneksi Anda, lalu coba lagi.
        </InlineAlert>
      ) : null}

      {transitError ? (
        <InlineAlert
          tone="warn"
          title="Angka “Di jalan” belum bisa dihitung"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Muat ulang
            </Button>
          }
        >
          Status dapur di bawah memakai stok yang ada saja, jadi bisa tampak lebih kurang dari
          sebenarnya.
        </InlineAlert>
      ) : null}

      <section className="ds-card ds-card-clip">
        <div className="ds-toolbar">
          <FilterChips
            label="Filter status"
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            items={[
              { id: "all", label: "Semua", count: counts.all },
              { id: "need", label: "Perlu diisi", count: counts.need },
              { id: "ok", label: "Aman", count: counts.ok },
            ]}
          />
          <label className="ds-search">
            <span className="ds-sr-only">Cari item</span>
            <input
              type="search"
              placeholder="Cari item, SKU, kategori"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {kitchen ? (
          <p className="ds-strip ds-strip-kitchen">
            Status dapur ikut menghitung barang yang sudah dikirim gudang tapi belum dikonfirmasi
            diterima.
          </p>
        ) : null}

        {loading ? (
          <div className="ds-empty">
            <p className="ds-empty-text">Memuat persediaan…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">
              {rows.length === 0 ? "Belum ada persediaan" : "Tidak ada yang cocok"}
            </p>
            <p className="ds-empty-text">
              {rows.length === 0
                ? "Tambahkan item di Master data, lalu catat persediaan masuknya."
                : "Ubah filter atau kata kunci pencarian."}
            </p>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table is-cozy is-stack">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Kategori</th>
                  <th className="is-num">Stok</th>
                  {kitchen ? <th className="is-num">Di jalan</th> : null}
                  <th className="ds-gauge-col">Terhadap minimum</th>
                  <th>Status</th>
                  <th>
                    <span className="ds-sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className={r.active ? undefined : "is-inactive"}>
                    <td data-title>
                      <div className="ds-cell-stack">
                        <span className="ds-cell-name">{r.name}</span>
                        <span className="ds-cell-sub ds-num">
                          {r.sku}
                          {r.active ? "" : " · Nonaktif"}
                        </span>
                      </div>
                    </td>
                    <td data-label="Kategori" className="ds-ink-2 ds-text-sm">{r.category ?? "—"}</td>
                    <td data-label="Stok" className="is-num ds-strong-cell">
                      <Qty value={r.qty} unit={r.unit} />
                    </td>
                    {kitchen ? (
                      <td data-label="Di jalan" className="is-num ds-nowrap">
                        {r.transit > 0 ? (
                          <Qty value={r.transit} unit={r.unit} tone="warn" />
                        ) : (
                          <span className="ds-muted-text">—</span>
                        )}
                      </td>
                    ) : null}
                    <td data-label="Terhadap minimum">
                      <MinGauge
                        layout="stacked"
                        effective={r.qty + r.transit}
                        min={r.min}
                        unit={r.unit}
                      />
                    </td>
                    <td data-label="Status" className="ds-nowrap">
                      {r.level === "critical" ? (
                        <StatusChip tone="danger">Kritis</StatusChip>
                      ) : r.level === "low" ? (
                        <StatusChip tone="warn">Menipis</StatusChip>
                      ) : (
                        <span className="ds-muted-text">Aman</span>
                      )}
                    </td>
                    <td data-action className="ds-cell-right">
                      <Link
                        className="ds-link"
                        href={`/app/history?item_id=${r.id}&location=${location}`}
                      >
                        Riwayat
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
