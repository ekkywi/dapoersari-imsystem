"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { kitchenApi, KitchenStock } from "@/lib/kitchen";
import { toastError } from "@/lib/toast";
import { Item, Unit, warehouseApi } from "@/lib/warehouse";

export default function KitchenStocksPage() {
  const [stocks, setStocks] = useState<KitchenStock[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stocks.filter((s) => {
      const item = itemMap[s.item_id];
      if (!q) return true;
      if (!item) return false;
      return (
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
      );
    });
  }, [stocks, itemMap, query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stockRows, itemRows, unitRows] = await Promise.all([
        kitchenApi.listStocks(),
        warehouseApi.listItems(),
        warehouseApi.listUnits(),
      ]);
      setStocks(stockRows);
      setItems(itemRows);
      setUnits(unitRows);
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
          <p className="lede">
            Saldo on-hand dapur. Bertambah setelah konfirmasi terima transfer.
          </p>
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
            placeholder="Cari SKU atau nama…"
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
            <p className="si-empty-desc">
              Stok muncul setelah item dibuat / transfer diterima.
            </p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nama</th>
                  <th>Satuan</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const item = itemMap[s.item_id];
                  const unit = item ? (unitMap[item.unit_id] ?? "—") : "—";
                  return (
                    <tr key={s.item_id}>
                      <td>
                        <strong>{item?.sku ?? "—"}</strong>
                      </td>
                      <td>{item?.name ?? s.item_id}</td>
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
