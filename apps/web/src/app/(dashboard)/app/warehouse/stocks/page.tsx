"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toastError } from "@/lib/toast";
import {
  Category,
  Item,
  Unit,
  WarehouseStock,
  warehouseApi,
} from "@/lib/warehouse";

export default function StocksPage() {
  const [stocks, setStocks] = useState<WarehouseStock[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const itemMap = useMemo(
    () => Object.fromEntries(items.map((it) => [it.id, it])),
    [items],
  );
  const unitMap = useMemo(
    () => Object.fromEntries(units.map((u) => [u.id, u.code])),
    [units],
  );
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stocks.filter((s) => {
      const item = itemMap[s.item_id];
      if (!q) return true;
      if (!item) return s.item_id.toLowerCase().includes(q);
      const unit = unitMap[item.unit_id] ?? "";
      const cat = item.category_id
        ? (categoryMap[item.category_id] ?? "")
        : "";
      return (
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        unit.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
  }, [stocks, itemMap, unitMap, categoryMap, query]);

  const lowCount = useMemo(
    () =>
      stocks.filter((s) => {
        const min = itemMap[s.item_id]?.min_stock ?? 0;
        return s.qty <= min;
      }).length,
    [stocks, itemMap],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stockRows, itemRows, unitRows, categoryRows] = await Promise.all([
        warehouseApi.listStocks(),
        warehouseApi.listItems(),
        warehouseApi.listUnits(),
        warehouseApi.listCategories(),
      ]);
      setStocks(stockRows);
      setItems(itemRows);
      setUnits(unitRows);
      setCategories(categoryRows);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat persediaan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Transaksi gudang</p>
          <h1 className="page-title">Persediaan</h1>
          <p className="lede">Saldo gudang per item.</p>
        </div>
      </header>

      <div className="si-toolbar">
        <div className="si-toolbar-meta">
          <p className="si-count">
            <strong>{rows.length}</strong> item ·{" "}
            <strong>{lowCount}</strong> di bawah min
          </p>
          <input
            className="input si-search"
            type="search"
            placeholder="Cari SKU, nama, satuan, kategori…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari persediaan"
          />
        </div>
        <div className="si-toolbar-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void load()}
          >
            Muat ulang
          </button>
          <Link className="btn btn-primary" href="/app/warehouse/stock-ins">
            Persediaan masuk
          </Link>
        </div>
      </div>

      <section className="si-table-card">
        {loading ? (
          <div className="si-empty">
            <p className="muted">Memuat data…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="si-empty">
            <p className="si-empty-title">
              {stocks.length === 0 ? "Belum ada persediaan" : "Tidak ada hasil"}
            </p>
            <p className="si-empty-desc">
              {stocks.length === 0
                ? "Belum ada item dengan saldo."
                : "Tidak cocok dengan pencarian."}
            </p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nama</th>
                  <th>Kategori</th>
                  <th>Satuan</th>
                  <th>Qty</th>
                  <th>Min</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const item = itemMap[s.item_id];
                  const min = item?.min_stock ?? 0;
                  const unit = item ? (unitMap[item.unit_id] ?? "—") : "—";
                  const cat =
                    item?.category_id
                      ? (categoryMap[item.category_id] ?? "—")
                      : "—";
                  const low = s.qty <= min;
                  return (
                    <tr key={s.item_id}>
                      <td>
                        <strong>{item?.sku ?? "—"}</strong>
                      </td>
                      <td>{item?.name ?? s.item_id}</td>
                      <td>{cat}</td>
                      <td>{unit}</td>
                      <td>{s.qty}</td>
                      <td>{min}</td>
                      <td>
                        {low ? (
                          <span className="badge badge-warn">Di bawah min</span>
                        ) : (
                          <span className="badge badge-success">Aman</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
