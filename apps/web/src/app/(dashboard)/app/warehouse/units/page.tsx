"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { getUser } from "@/lib/auth";
import { toastError, toastSuccess } from "@/lib/toast";
import { Unit, canMutateWarehouse, warehouseApi } from "@/lib/warehouse";

export default function UnitsPage() {
  const [rows, setRows] = useState<Unit[]>([]);
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        u.code.toLowerCase().includes(q) || u.name.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const load = useCallback(async () => {
    try {
      setRows(await warehouseApi.listUnits());
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat satuan");
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
    setCode("");
    setName("");
    setFormError(null);
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setFormError(null);
    try {
      await warehouseApi.createUnit({ code, name });
      setDrawerOpen(false);
      toastSuccess("Satuan berhasil ditambahkan");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menambah satuan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Master gudang</p>
          <h1 className="page-title">Satuan</h1>
          <p className="lede">Master satuan baku untuk katalog item.</p>
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
            placeholder="Cari kode atau nama…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari satuan"
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
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Tambah satuan
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
              {rows.length === 0 ? "Belum ada satuan" : "Tidak ada hasil"}
            </p>
            <p className="si-empty-desc">
              {rows.length === 0
                ? "Tambah satuan sebelum membuat item katalog."
                : "Coba ubah kata kunci pencarian."}
            </p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.code}</strong>
                    </td>
                    <td>{u.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer
        open={drawerOpen}
        title="Tambah satuan"
        description="Kode singkat dan nama tampilan."
        onClose={() => setDrawerOpen(false)}
      >
        {formError ? <p className="error">{formError}</p> : null}
        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <label className="label" htmlFor="unit-code">
              Kode
            </label>
            <input
              id="unit-code"
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="kg"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="unit-name">
              Nama
            </label>
            <input
              id="unit-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kilogram"
              required
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
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
