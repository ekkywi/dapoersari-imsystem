"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { getUser } from "@/lib/auth";
import { kitchenApi, Menu, MenuClosing } from "@/lib/kitchen";
import { canMutateKitchen } from "@/lib/rbac";
import { toastError, toastSuccess } from "@/lib/toast";

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type DraftPkg = { menu_id: string; qty_paket: string };

export default function ClosingsPage() {
  const [rows, setRows] = useState<MenuClosing[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [closingDate, setClosingDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [packages, setPackages] = useState<DraftPkg[]>([
    { menu_id: "", qty_paket: "1" },
  ]);
  const [detail, setDetail] = useState<MenuClosing | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.closing_date.includes(q) ||
        (r.note ?? "").toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const load = useCallback(async () => {
    try {
      const [closings, menuRows] = await Promise.all([
        kitchenApi.listClosings(),
        kitchenApi.listMenus(),
      ]);
      setRows(closings);
      setMenus(menuRows.filter((m) => m.is_active));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat penutupan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setCanWrite(user ? canMutateKitchen(user.role) : false);
    void load();
  }, [load]);

  function openCreate() {
    setClosingDate(todayISO());
    setNote("");
    setPackages([{ menu_id: menus[0]?.id ?? "", qty_paket: "1" }]);
    setFormError(null);
    setDrawerOpen(true);
  }

  async function openDetail(id: string) {
    try {
      setDetail(await kitchenApi.getClosing(id));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat detail");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    const pkgs = packages
      .map((p) => ({
        menu_id: p.menu_id,
        qty_paket: Number(p.qty_paket),
      }))
      .filter((p) => p.menu_id && p.qty_paket > 0);
    if (!closingDate || pkgs.length === 0) {
      setFormError("Tanggal dan minimal satu paket menu wajib diisi");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await kitchenApi.createClosing({
        closing_date: closingDate,
        note: note.trim() || null,
        packages: pkgs,
      });
      setDrawerOpen(false);
      toastSuccess("Penutupan menu tersimpan; stok dapur dikurangi");
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
          <p className="section-label">Dapur</p>
          <h1 className="page-title">Penutupan menu</h1>
          <p className="lede">Qty paket terjual atau diproduksi.</p>
        </div>
      </header>

      <div className="si-toolbar">
        <div className="si-toolbar-meta">
          <p className="si-count">
            <strong>{filtered.length}</strong> dari {rows.length} dokumen
          </p>
          <input
            className="input si-search"
            type="search"
            placeholder="Cari tanggal / catatan…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="si-toolbar-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Muat ulang
          </button>
          {canWrite ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Tutup shift
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
            <p className="si-empty-title">Belum ada penutupan</p>
            <p className="si-empty-desc">Belum ada dokumen penutupan.</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Dicatat</th>
                  <th>Catatan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.closing_date}</td>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td>{r.note || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void openDetail(r.id)}
                      >
                        Buka
                      </button>
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
        title="Penutupan menu"
        description="Input qty paket per menu."
        onClose={() => setDrawerOpen(false)}
      >
        {formError ? <p className="error">{formError}</p> : null}
        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <label className="label">Tanggal</label>
            <input
              className="input"
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              required
            />
          </div>
          {packages.map((p, idx) => (
            <div key={idx} className="field">
              <label className="label">Paket {idx + 1}</label>
              <select
                className="input select"
                value={p.menu_id}
                onChange={(e) => {
                  const next = [...packages];
                  next[idx] = { ...p, menu_id: e.target.value };
                  setPackages(next);
                }}
              >
                <option value="">— pilih menu —</option>
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                className="input"
                style={{ marginTop: "0.5rem" }}
                type="number"
                min={0.001}
                step="0.001"
                value={p.qty_paket}
                onChange={(e) => {
                  const next = [...packages];
                  next[idx] = { ...p, qty_paket: e.target.value };
                  setPackages(next);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setPackages((prev) => [
                ...prev,
                { menu_id: menus[0]?.id ?? "", qty_paket: "1" },
              ])
            }
          >
            + Tambah paket
          </button>
          <div className="field">
            <label className="label">Catatan</label>
            <input
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
              {saving ? "Menyimpan…" : "Simpan & kurangi stok"}
            </button>
          </div>
        </form>
      </Drawer>

      <Drawer
        open={!!detail}
        title="Detail penutupan"
        description={
          detail
            ? `${detail.closing_date} · ${formatDateTime(detail.created_at)}`
            : undefined
        }
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <>
            <p className="muted">{detail.note || "Tanpa catatan"}</p>
            <h2 className="panel-title">Paket</h2>
            <ul>
              {(detail.packages ?? []).map((p) => (
                <li key={p.id}>
                  {p.menu_name} × {p.qty_paket}
                </li>
              ))}
            </ul>
            <h2 className="panel-title">Rincian bahan</h2>
            <ul>
              {(detail.lines ?? []).map((l) => (
                <li key={l.id}>
                  {l.item_sku} — {l.item_name}: {l.qty} {l.unit_code}
                </li>
              ))}
            </ul>
            <div className="drawer-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDetail(null)}
              >
                Tutup
              </button>
              <Link className="btn btn-ghost" href="/app/history">
                Lihat riwayat
              </Link>
            </div>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
