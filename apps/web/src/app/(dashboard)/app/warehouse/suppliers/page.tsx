"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { getUser } from "@/lib/auth";
import { toastError, toastSuccess } from "@/lib/toast";
import { Supplier, canMutateWarehouse, warehouseApi } from "@/lib/warehouse";

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const load = useCallback(async () => {
    try {
      setRows(await warehouseApi.listSuppliers());
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat pemasok");
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
    setName("");
    setPhone("");
    setNote("");
    setFormError(null);
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setFormError(null);
    try {
      await warehouseApi.createSupplier({
        name,
        phone: phone.trim() || null,
        note: note.trim() || null,
      });
      setDrawerOpen(false);
      toastSuccess("Pemasok berhasil ditambahkan");
      await load();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menambah pemasok",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Master gudang</p>
          <h1 className="page-title">Pemasok</h1>
          <p className="lede">Daftar pemasok.</p>
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
            placeholder="Cari nama atau telepon…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari pemasok"
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
              Tambah pemasok
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
              {rows.length === 0 ? "Belum ada pemasok" : "Tidak ada hasil"}
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
                  <th>Telepon</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.phone || "—"}</td>
                    <td>
                      {s.is_active ? (
                        <span className="badge badge-success">Aktif</span>
                      ) : (
                        <span className="badge badge-neutral">Nonaktif</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer
        open={drawerOpen}
        title="Tambah pemasok"
        description="Nama dan kontak."
        onClose={() => setDrawerOpen(false)}
      >
        {formError ? <p className="error">{formError}</p> : null}
        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <label className="label" htmlFor="sup-name">
              Nama
            </label>
            <input
              id="sup-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="sup-phone">
              Telepon
            </label>
            <input
              id="sup-phone"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="sup-note">
              Catatan
            </label>
            <input
              id="sup-note"
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
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
