"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { getUser } from "@/lib/auth";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  Category,
  Item,
  StockIn,
  Supplier,
  Unit,
  canMutateWarehouse,
  warehouseApi,
} from "@/lib/warehouse";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function StockInsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<StockIn[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [itemId, setItemId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [expiredAt, setExpiredAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const itemMap = useMemo(
    () => Object.fromEntries(items.map((it) => [it.id, it])),
    [items],
  );
  const supplierMap = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.id, s.name])),
    [suppliers],
  );
  const unitMap = useMemo(
    () => Object.fromEntries(units.map((u) => [u.id, u.code])),
    [units],
  );
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const selectedUnitCode = useMemo(() => {
    const item = itemMap[itemId];
    if (!item) return "";
    return unitMap[item.unit_id] ?? "";
  }, [itemId, itemMap, unitMap]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const item = itemMap[r.item_id];
      const supplier = r.supplier_id ? (supplierMap[r.supplier_id] ?? "") : "";
      const unit = item ? (unitMap[item.unit_id] ?? "") : "";
      const cat =
        item?.category_id ? (categoryMap[item.category_id] ?? "") : "";
      const label = item ? `${item.sku} ${item.name}` : r.item_id;
      return (
        label.toLowerCase().includes(q) ||
        supplier.toLowerCase().includes(q) ||
        unit.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
  }, [rows, query, itemMap, supplierMap, unitMap, categoryMap]);

  const load = useCallback(async () => {
    try {
      const [ins, itemRows, supplierRows, unitRows, categoryRows] =
        await Promise.all([
          warehouseApi.listStockIns(),
          warehouseApi.listItems(),
          warehouseApi.listSuppliers(),
          warehouseApi.listUnits(),
          warehouseApi.listCategories(),
        ]);
      setRows(ins);
      setItems(itemRows);
      setSuppliers(supplierRows);
      setUnits(unitRows);
      setCategories(categoryRows);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat persediaan masuk");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setCanWrite(user ? canMutateWarehouse(user.role) : false);
    void load();
  }, [load]);

  function openCreate() {
    setItemId(items[0]?.id ?? "");
    setSupplierId("");
    setQty("");
    setNote("");
    setExpiredAt("");
    setFormError(null);
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    const qtyNum = Number(qty);
    if (!itemId || !(qtyNum > 0)) {
      setFormError("Item dan qty harus diisi (qty lebih dari 0)");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await warehouseApi.createStockIn({
        item_id: itemId,
        supplier_id: supplierId || null,
        qty: qtyNum,
        note: note.trim() || null,
        expired_at: expiredAt
          ? new Date(`${expiredAt}T00:00:00.000Z`).toISOString()
          : null,
      });
      setDrawerOpen(false);
      toastSuccess(`Persediaan masuk tercatat. Qty gudang: ${res.stock.qty}`);
      router.push(`/app/warehouse/stock-ins/${res.stock_in.id}`);
      return;
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal mencatat persediaan masuk",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Transaksi gudang</p>
          <h1 className="page-title">Persediaan masuk</h1>
          <p className="lede">Penerimaan barang ke gudang.</p>
        </div>
      </header>

      <div className="si-toolbar">
        <div className="si-toolbar-meta">
          <p className="si-count">
            <strong>{filtered.length}</strong> dari {rows.length} transaksi
          </p>
          <input
            className="input si-search"
            type="search"
            placeholder="Cari item atau pemasok…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari persediaan masuk"
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
          {canWrite ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
              disabled={items.length === 0}
              title={
                items.length === 0 ? "Buat item terlebih dahulu" : undefined
              }
            >
              Catat persediaan masuk
            </button>
          ) : null}
        </div>
      </div>

      <section className="si-table-card">
        {loading ? (
          <div className="si-empty">
            <p className="muted">Memuat data…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="si-empty">
            <p className="si-empty-title">
              {rows.length === 0 ? "Belum ada transaksi" : "Tidak ada hasil"}
            </p>
            <p className="si-empty-desc">
              {rows.length === 0
                ? items.length === 0
                  ? "Belum ada item katalog."
                  : "Belum ada transaksi persediaan masuk."
                : "Tidak cocok dengan pencarian."}
            </p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Item</th>
                  <th>Kategori</th>
                  <th>Satuan</th>
                  <th>Pemasok</th>
                  <th>Qty</th>
                  <th>ED</th>
                  <th>Catatan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const item = itemMap[r.item_id];
                  const unit = item ? (unitMap[item.unit_id] ?? "—") : "—";
                  const cat =
                    item?.category_id
                      ? (categoryMap[item.category_id] ?? "—")
                      : "—";
                  return (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.created_at)}</td>
                      <td>
                        {item ? (
                          <>
                            <strong>{item.sku}</strong>
                            <span className="muted"> — {item.name}</span>
                          </>
                        ) : (
                          r.item_id
                        )}
                      </td>
                      <td>{cat}</td>
                      <td>{unit}</td>
                      <td>
                        {r.supplier_id
                          ? (supplierMap[r.supplier_id] ?? "—")
                          : "—"}
                      </td>
                      <td>{r.qty}</td>
                      <td>
                        {r.expired_at
                          ? new Date(r.expired_at).toLocaleDateString("id-ID")
                          : "—"}
                      </td>
                      <td>{r.note || "—"}</td>
                      <td>
                        <Link
                          className="btn btn-ghost"
                          href={`/app/warehouse/stock-ins/${r.id}`}
                        >
                          Buka
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer
        open={drawerOpen}
        title="Catat persediaan masuk"
        description="Item, qty, dan pemasok."
        onClose={() => setDrawerOpen(false)}
      >
        {formError ? <p className="error">{formError}</p> : null}
        {items.length === 0 ? (
          <p className="muted">Tambah item katalog terlebih dahulu.</p>
        ) : (
          <form className="form" onSubmit={onSubmit}>
            <div className="field">
              <label className="label" htmlFor="si-item">
                Item
              </label>
              <select
                id="si-item"
                className="input select"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                required
              >
                {items.map((it) => {
                  const unit = unitMap[it.unit_id] ?? "";
                  return (
                    <option key={it.id} value={it.id}>
                      {it.sku} — {it.name}
                      {unit ? ` (${unit})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="si-supplier">
                Pemasok
              </label>
              <select
                id="si-supplier"
                className="input select"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">— Tidak diisi —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="si-qty">
                Qty{selectedUnitCode ? ` (${selectedUnitCode})` : ""}
              </label>
              <input
                id="si-qty"
                className="input"
                type="number"
                min={0.001}
                step="0.001"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
                autoFocus
              />
              {selectedUnitCode ? (
                <p className="muted" style={{ marginTop: "0.25rem" }}>
                  Satuan mengikuti item: {selectedUnitCode}
                </p>
              ) : null}
            </div>
            <div className="field">
              <label className="label" htmlFor="si-ed">
                Kedaluwarsa
              </label>
              <input
                id="si-ed"
                className="input"
                type="date"
                value={expiredAt}
                onChange={(e) => setExpiredAt(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="si-note">
                Catatan
              </label>
              <input
                id="si-note"
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="drawer-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDrawerOpen(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Menyimpan…" : "Simpan transaksi"}
              </button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
