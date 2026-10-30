"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { kitchenApi, KitchenStock } from "@/lib/kitchen";
import { toastError } from "@/lib/toast";
import { Category, Item, Unit, warehouseApi } from "@/lib/warehouse";

export default function KitchenStocksPage() {
  const [stocks, setStocks] = useState<KitchenStock[]>([]);
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
      if (!item) return false;
      const cat = item.category_id
        ? (categoryMap[item.category_id] ?? "")
        : "";
      return (
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
  }, [stocks, itemMap, categoryMap, query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stockRows, itemRows, unitRows, categoryRows] = await Promise.all([
        kitchenApi.listStocks(),
        warehouseApi.listItems(),
        warehouseApi.listUnits(),
        warehouseApi.listCategories(),
      ]);
      setStocks(stockRows);
      setItems(itemRows);
      setUnits(unitRows);
      setCategories(categoryRows);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat stok dapur");
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
          <p className="section-label">Dapur</p>
          <h1 className="page-title">Stok dapur</h1>
          <p className="lede">Saldo dapur per item.</p>
        </div>
      </header>

      <div className="si-toolbar">
        <div className="si-toolbar-meta">
          <p className="si-count">
            <strong>{rows.length}</strong> item
          </p>
          <input
            className="input si-search"
            type="search"
            placeholder="Cari SKU, nama, kategori…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="si-toolbar-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Muat ulang
          </button>
        </div>
      </div>

      <section className="si-table-card">
        {loading ? (
          <div className="si-empty">
            <p className="muted">Memuat data…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="si-empty">
            <p className="si-empty-title">Belum ada stok dapur</p>
            <p className="si-empty-desc">Belum ada saldo dapur.</p>
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
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const item = itemMap[s.item_id];
                  const unit = item ? (unitMap[item.unit_id] ?? "—") : "—";
                  const cat =
                    item?.category_id
                      ? (categoryMap[item.category_id] ?? "—")
                      : "—";
                  return (
                    <tr key={s.item_id}>
                      <td>
                        <strong>{item?.sku ?? "—"}</strong>
                      </td>
                      <td>{item?.name ?? s.item_id}</td>
                      <td>{cat}</td>
                      <td>{unit}</td>
                      <td>{s.qty}</td>
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
