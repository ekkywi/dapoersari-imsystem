"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { getUser } from "@/lib/auth";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  Category,
  Item,
  Unit,
  canMutateWarehouse,
  warehouseApi,
} from "@/lib/warehouse";

export default function ItemsPage() {
  const [rows, setRows] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);

  const unitMap = useMemo(
    () => Object.fromEntries(units.map((u) => [u.id, u.code])),
    [units],
  );
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((it) => {
      const cat = it.category_id ? (categoryMap[it.category_id] ?? "") : "";
      return (
        it.sku.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
  }, [rows, query, categoryMap]);

  const load = useCallback(async () => {
    try {
      const [items, unitRows, categoryRows] = await Promise.all([
        warehouseApi.listItems(),
        warehouseApi.listUnits(),
        warehouseApi.listCategories(),
      ]);
      setRows(items);
      setUnits(unitRows);
      setCategories(categoryRows);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat item");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setCanWrite(user ? canMutateWarehouse(user.role) : false);
    void load();
  }, [load]);

  function closeDrawer() {
    setDrawerMode(null);
    setEditing(null);
    setFormError(null);
  }

  function openCreate() {
    setEditing(null);
    setSku("");
    setName("");
    setMinStock("0");
    setCategoryId("");
    setUnitId(units[0]?.id ?? "");
    setFormError(null);
    setDrawerMode("create");
  }

  function openEdit(it: Item) {
    setEditing(it);
    setSku(it.sku);
    setName(it.name);
    setMinStock(String(it.min_stock));
    setCategoryId(it.category_id ?? "");
    setUnitId(it.unit_id);
    setFormError(null);
    setDrawerMode("edit");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setFormError(null);
    try {
      if (drawerMode === "create") {
        await warehouseApi.createItem({
          sku,
          name,
          unit_id: unitId,
          category_id: categoryId || null,
          min_stock: Number(minStock) || 0,
        });
        toastSuccess("Item berhasil ditambahkan");
      } else if (drawerMode === "edit" && editing) {
        const body: Parameters<typeof warehouseApi.patchItem>[1] = {
          sku,
          name,
          min_stock: Number(minStock) || 0,
        };
        if (categoryId) {
          body.category_id = categoryId;
        } else {
          body.clear_category = true;
        }
        await warehouseApi.patchItem(editing.id, body);
        toastSuccess("Item diperbarui");
      }
      closeDrawer();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(it: Item) {
    if (!canWrite) return;
    const next = !it.is_active;
    const ok = window.confirm(
      next
        ? `Aktifkan ${it.name}?`
        : `Nonaktifkan ${it.name}? Item tidak bisa dipilih di transaksi baru.`,
    );
    if (!ok) return;
    try {
      await warehouseApi.patchItem(it.id, { is_active: next });
      toastSuccess(next ? "Item diaktifkan" : "Item dinonaktifkan");
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal mengubah status");
    }
  }

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Master gudang</p>
          <h1 className="page-title">Item</h1>
          <p className="lede">Katalog bahan gudang.</p>
        </div>
      </header>

      <div className="si-toolbar">
        <div className="si-toolbar-meta">
          <p className="si-count">
            <strong>{filtered.length}</strong> dari {rows.length} data
          </p>
          <input
            className="input si-search"
            type="search"
            placeholder="Cari SKU, nama, kategori…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari item"
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
              disabled={units.length === 0}
              title={
                units.length === 0 ? "Buat satuan terlebih dahulu" : undefined
              }
            >
              Tambah item
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
              {rows.length === 0 ? "Belum ada item" : "Tidak ada hasil"}
            </p>
            <p className="si-empty-desc">
              {rows.length === 0
                ? units.length === 0
                  ? "Belum ada satuan."
                  : "Belum ada data."
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
                  <th>Satuan</th>
                  <th>Kategori</th>
                  <th>Min</th>
                  <th>Status</th>
                  {canWrite ? <th>Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <strong>{it.sku}</strong>
                    </td>
                    <td>{it.name}</td>
                    <td>{unitMap[it.unit_id] ?? "—"}</td>
                    <td>
                      {it.category_id
                        ? (categoryMap[it.category_id] ?? "—")
                        : "—"}
                    </td>
                    <td>{it.min_stock}</td>
                    <td>
                      {it.is_active ? (
                        <span className="badge badge-success">Aktif</span>
                      ) : (
                        <span className="badge badge-neutral">Nonaktif</span>
                      )}
                    </td>
                    {canWrite ? (
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => openEdit(it)}
                        >
                          Edit
                        </button>{" "}
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void toggleActive(it)}
                        >
                          {it.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer
        open={drawerMode !== null}
        title={drawerMode === "edit" ? "Edit item" : "Tambah item"}
        description={
          drawerMode === "edit"
            ? "SKU, nama, kategori, min stok. Satuan tidak diubah."
            : "SKU, nama, satuan, kategori."
        }
        onClose={closeDrawer}
      >
        {formError ? <p className="error">{formError}</p> : null}
        {units.length === 0 ? (
          <p className="muted">Buat satuan terlebih dahulu.</p>
        ) : (
          <form className="form" onSubmit={(e) => void onSubmit(e)}>
            <div className="field">
              <label className="label" htmlFor="item-sku">
                SKU
              </label>
              <input
                id="item-sku"
                className="input"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="item-name">
                Nama
              </label>
              <input
                id="item-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="item-unit">
                Satuan
              </label>
              <select
                id="item-unit"
                className="input select"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                required
                disabled={drawerMode === "edit"}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="item-cat">
                Kategori
              </label>
              <select
                id="item-cat"
                className="input select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">— Tidak ada —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="item-min">
                Persediaan minimum
              </label>
              <input
                id="item-min"
                className="input"
                type="number"
                min={0}
                step="0.001"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
              />
            </div>
            <div className="drawer-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeDrawer}
              >
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
