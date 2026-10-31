"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { getUser } from "@/lib/auth";
import { toastError, toastSuccess } from "@/lib/toast";
import { Category, canMutateWarehouse, warehouseApi } from "@/lib/warehouse";

export default function CategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) => c.name.toLowerCase().includes(q));
  }, [rows, query]);

  const load = useCallback(async () => {
    try {
      setRows(await warehouseApi.listCategories());
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat kategori");
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
    setName("");
    setFormError(null);
    setDrawerMode("create");
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
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
        await warehouseApi.createCategory({ name });
        toastSuccess("Kategori berhasil ditambahkan");
      } else if (drawerMode === "edit" && editing) {
        await warehouseApi.patchCategory(editing.id, { name });
        toastSuccess("Kategori diperbarui");
      }
      closeDrawer();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Master gudang</p>
          <h1 className="page-title">Kategori</h1>
          <p className="lede">Kelompok item (opsional).</p>
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
            placeholder="Cari nama…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari kategori"
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
            >
              Tambah kategori
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
              {rows.length === 0 ? "Belum ada kategori" : "Tidak ada hasil"}
            </p>
            <p className="si-empty-desc">
              {rows.length === 0
                ? "Belum ada data."
                : "Tidak cocok dengan pencarian."}
            </p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  {canWrite ? <th>Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    {canWrite ? (
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => openEdit(c)}
                        >
                          Edit
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
        title={drawerMode === "edit" ? "Edit kategori" : "Tambah kategori"}
        description="Nama kategori."
        onClose={closeDrawer}
      >
        {formError ? <p className="error">{formError}</p> : null}
        <form className="form" onSubmit={(e) => void onSubmit(e)}>
          <div className="field">
            <label className="label" htmlFor="cat-name">
              Nama
            </label>
            <input
              id="cat-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sayuran"
              required
              autoFocus
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
      </Drawer>
    </div>
  );
}
