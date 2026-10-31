"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { getUser } from "@/lib/auth";
import { kitchenApi, Menu } from "@/lib/kitchen";
import { canMutateKitchen } from "@/lib/rbac";
import { toastError, toastSuccess } from "@/lib/toast";
import { Item, warehouseApi } from "@/lib/warehouse";

type DraftLine = { item_id: string; qty_per_paket: string };
type DrawerMode = "create" | "edit" | null;

export default function MenusPage() {
  const [rows, setRows] = useState<Menu[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { item_id: "", qty_per_paket: "1" },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [editing, setEditing] = useState<Menu | null>(null);
  const [detail, setDetail] = useState<Menu | null>(null);

  const activeItems = useMemo(
    () => items.filter((it) => it.is_active),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((m) => m.name.toLowerCase().includes(q));
  }, [rows, query]);

  const load = useCallback(async () => {
    try {
      const [menus, itemRows] = await Promise.all([
        kitchenApi.listMenus(),
        warehouseApi.listItems(),
      ]);
      setRows(menus);
      setItems(itemRows);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat menu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setCanWrite(user ? canMutateKitchen(user.role) : false);
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
    setLines([{ item_id: activeItems[0]?.id ?? "", qty_per_paket: "1" }]);
    setFormError(null);
    setDrawerMode("create");
  }

  async function openEdit(id: string) {
    try {
      const m = await kitchenApi.getMenu(id);
      setEditing(m);
      setName(m.name);
      setLines(
        (m.lines ?? []).map((l) => ({
          item_id: l.item_id,
          qty_per_paket: String(l.qty_per_paket),
        })),
      );
      if (!(m.lines && m.lines.length > 0)) {
        setLines([{ item_id: activeItems[0]?.id ?? "", qty_per_paket: "1" }]);
      }
      setFormError(null);
      setDrawerMode("edit");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat menu");
    }
  }

  async function openDetail(id: string) {
    try {
      setDetail(await kitchenApi.getMenu(id));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat detail");
    }
  }

  function parseLines() {
    return lines
      .map((l) => ({
        item_id: l.item_id,
        qty_per_paket: Number(l.qty_per_paket),
      }))
      .filter((l) => l.item_id && l.qty_per_paket > 0);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    const parsed = parseLines();
    if (!name.trim() || parsed.length === 0) {
      setFormError("Nama menu dan minimal satu bahan wajib diisi");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (drawerMode === "create") {
        await kitchenApi.createMenu({ name, lines: parsed });
        toastSuccess("Menu/resep berhasil ditambahkan");
      } else if (drawerMode === "edit" && editing) {
        await kitchenApi.patchMenu(editing.id, { name });
        await kitchenApi.replaceRecipe(editing.id, { lines: parsed });
        toastSuccess("Menu/resep diperbarui");
      }
      closeDrawer();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m: Menu) {
    if (!canWrite) return;
    const next = !m.is_active;
    const ok = window.confirm(
      next
        ? `Aktifkan ${m.name}?`
        : `Nonaktifkan ${m.name}? Menu tidak dipakai di penutupan baru.`,
    );
    if (!ok) return;
    try {
      await kitchenApi.patchMenu(m.id, { is_active: next });
      toastSuccess(next ? "Menu diaktifkan" : "Menu dinonaktifkan");
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal mengubah status");
    }
  }

  const itemOptions = useMemo(() => {
    const idsInForm = new Set(lines.map((l) => l.item_id).filter(Boolean));
    return items.filter((it) => it.is_active || idsInForm.has(it.id));
  }, [items, lines]);

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Dapur</p>
          <h1 className="page-title">Resep / menu</h1>
          <p className="lede">Menu dan resep bahan.</p>
        </div>
      </header>

      <div className="si-toolbar">
        <div className="si-toolbar-meta">
          <p className="si-count">
            <strong>{filtered.length}</strong> dari {rows.length} menu
          </p>
          <input
            className="input si-search"
            type="search"
            placeholder="Cari nama menu…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
              disabled={activeItems.length === 0}
            >
              Tambah menu
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
            <p className="si-empty-title">Belum ada menu</p>
            <p className="si-empty-desc">Belum ada menu.</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.name}</strong>
                    </td>
                    <td>
                      {m.is_active ? (
                        <span className="badge badge-success">Aktif</span>
                      ) : (
                        <span className="badge badge-neutral">Nonaktif</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void openDetail(m.id)}
                      >
                        Detail
                      </button>
                      {canWrite ? (
                        <>
                          {" "}
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => void openEdit(m.id)}
                          >
                            Edit
                          </button>{" "}
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => void toggleActive(m)}
                          >
                            {m.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer
        open={drawerMode !== null}
        title={drawerMode === "edit" ? "Edit menu / resep" : "Tambah menu"}
        description="Nama menu dan komposisi bahan per paket."
        onClose={closeDrawer}
      >
        {formError ? <p className="error">{formError}</p> : null}
        <form className="form" onSubmit={(e) => void onSubmit(e)}>
          <div className="field">
            <label className="label" htmlFor="menu-name">
              Nama menu
            </label>
            <input
              id="menu-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          {lines.map((line, idx) => (
            <div key={idx} className="form-grid form-grid-2">
              <div className="field">
                <label className="label">Bahan</label>
                <select
                  className="input select"
                  value={line.item_id}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], item_id: e.target.value };
                    setLines(next);
                  }}
                  required
                >
                  <option value="">— pilih —</option>
                  {itemOptions.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.sku} — {it.name}
                      {!it.is_active ? " (nonaktif)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label">Qty / paket</label>
                <input
                  className="input"
                  type="number"
                  min={0.001}
                  step="0.001"
                  value={line.qty_per_paket}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], qty_per_paket: e.target.value };
                    setLines(next);
                  }}
                  required
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { item_id: activeItems[0]?.id ?? "", qty_per_paket: "1" },
              ])
            }
          >
            + Bahan
          </button>
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

      <Drawer
        open={!!detail}
        title={detail?.name ?? "Detail resep"}
        description="Komposisi bahan per paket."
        onClose={() => setDetail(null)}
      >
        {detail?.lines && detail.lines.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nama</th>
                  <th>Qty</th>
                  <th>Satuan</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.item_sku}</td>
                    <td>{l.item_name}</td>
                    <td>{l.qty_per_paket}</td>
                    <td>{l.unit_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Belum ada bahan.</p>
        )}
      </Drawer>
    </div>
  );
}
