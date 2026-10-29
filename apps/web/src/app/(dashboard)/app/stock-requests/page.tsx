"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { getUser } from "@/lib/auth";
import { kitchenApi, Menu } from "@/lib/kitchen";
import {
  defaultStatusesForFocus,
  parseRequestFocus,
  showKitchenRequestActions,
  showWarehouseRequestActions,
} from "@/lib/rbac";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  requestStatusLabel,
  StockRequest,
  transferApi,
} from "@/lib/transfer";
import { Item, warehouseApi } from "@/lib/warehouse";

const ALL_STATUSES = [
  "submitted",
  "approved",
  "transferred",
  "received",
  "rejected",
] as const;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function StockRequestsContent() {
  const searchParams = useSearchParams();
  const focus = parseRequestFocus(searchParams.get("focus"));

  const [rows, setRows] = useState<StockRequest[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showKitchenUi, setShowKitchenUi] = useState(false);
  const [showWarehouseUi, setShowWarehouseUi] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [menuId, setMenuId] = useState("");
  const [qtyPaket, setQtyPaket] = useState("1");
  const [extraItemId, setExtraItemId] = useState("");
  const [extraQty, setExtraQty] = useState("");

  useEffect(() => {
    if (focus) {
      setStatusFilter(defaultStatusesForFocus(focus));
    } else {
      setStatusFilter(null);
    }
  }, [focus]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter && statusFilter.length > 0) {
      const allowed = new Set(statusFilter);
      list = list.filter((r) => allowed.has(r.status));
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.status.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.note ?? "").toLowerCase().includes(q),
    );
  }, [rows, query, statusFilter]);

  const load = useCallback(async () => {
    try {
      const [reqs, menuRows, itemRows] = await Promise.all([
        transferApi.list(),
        kitchenApi.listMenus(),
        warehouseApi.listItems(),
      ]);
      setRows(reqs);
      setMenus(menuRows);
      setItems(itemRows);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat permintaan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    if (user) {
      setShowKitchenUi(showKitchenRequestActions(user.role, focus));
      setShowWarehouseUi(showWarehouseRequestActions(user.role, focus));
    }
    void load();
  }, [load, focus]);

  function openCreate() {
    setNote("");
    setMenuId(menus[0]?.id ?? "");
    setQtyPaket("1");
    setExtraItemId("");
    setExtraQty("");
    setFormError(null);
    setDrawerOpen(true);
  }

  function detailHref(id: string): string {
    return focus
      ? `/app/stock-requests/${id}?focus=${focus}`
      : `/app/stock-requests/${id}`;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!showKitchenUi) return;
    const packages =
      menuId && Number(qtyPaket) > 0
        ? [{ menu_id: menuId, qty_paket: Number(qtyPaket) }]
        : [];
    const extra_items =
      extraItemId && Number(extraQty) > 0
        ? [{ item_id: extraItemId, qty: Number(extraQty) }]
        : [];
    if (packages.length === 0 && extra_items.length === 0) {
      setFormError("Isi paket menu dan/atau item tambahan");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await transferApi.create({
        note: note.trim() || null,
        packages,
        extra_items,
      });
      setDrawerOpen(false);
      toastSuccess("Permintaan stok diajukan");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal mengajukan");
    } finally {
      setSaving(false);
    }
  }

  function toggleStatus(status: string) {
    setStatusFilter((prev) => {
      if (prev === null) return [status];
      if (prev.includes(status)) {
        const next = prev.filter((s) => s !== status);
        return next.length === 0 ? null : next;
      }
      return [...prev, status];
    });
  }

  const title =
    focus === "warehouse"
      ? "Antrian permintaan"
      : focus === "kitchen"
        ? "Permintaan stok"
        : "Permintaan stok";
  const sectionLabel =
    focus === "warehouse" ? "Gudang" : focus === "kitchen" ? "Dapur" : "Transfer";
  const lede =
    focus === "warehouse"
      ? "Antrian yang menunggu persetujuan atau siap ditransfer."
      : focus === "kitchen"
        ? "Ajukan permintaan, pantau status, dan terima transfer masuk."
        : "Dapur mengajukan → gudang setujui & transfer → dapur terima.";

  const showAll = statusFilter === null || statusFilter.length === 0;

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">{sectionLabel}</p>
          <h1 className="page-title">{title}</h1>
          <p className="lede">{lede}</p>
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
            placeholder="Cari status / catatan…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="si-toolbar-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Muat ulang
          </button>
          {showKitchenUi ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Ajukan permintaan
            </button>
          ) : null}
        </div>
      </div>

      <div className="si-filter-row" role="group" aria-label="Filter status">
        <button
          type="button"
          className={showAll ? "si-filter-chip is-active" : "si-filter-chip"}
          onClick={() => setStatusFilter(null)}
        >
          Semua
        </button>
        {ALL_STATUSES.map((status) => {
          const active = !showAll && (statusFilter?.includes(status) ?? false);
          return (
            <button
              key={status}
              type="button"
              className={active ? "si-filter-chip is-active" : "si-filter-chip"}
              onClick={() => toggleStatus(status)}
            >
              {requestStatusLabel(status)}
            </button>
          );
        })}
      </div>

      <section className="si-table-card">
        {loading ? (
          <div className="si-empty">
            <p className="muted">Memuat data…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="si-empty">
            <p className="si-empty-title">Belum ada permintaan</p>
            <p className="si-empty-desc">
              {showAll
                ? "Buat resep menu, lalu ajukan permintaan dari dapur."
                : "Tidak ada dokumen dengan status terpilih. Coba “Semua”."}
            </p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Status</th>
                  <th>Catatan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td>
                      <span className="badge badge-neutral">
                        {requestStatusLabel(r.status)}
                      </span>
                    </td>
                    <td>{r.note || "—"}</td>
                    <td>
                      <Link className="btn btn-ghost" href={detailHref(r.id)}>
                        Buka
                      </Link>
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
        title="Ajukan permintaan"
        description="Pilih paket menu dan/atau item langsung. Bahan digabung otomatis."
        onClose={() => setDrawerOpen(false)}
      >
        {formError ? <p className="error">{formError}</p> : null}
        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <label className="label">Menu (paket)</label>
            <select
              className="input select"
              value={menuId}
              onChange={(e) => setMenuId(e.target.value)}
            >
              <option value="">— tidak memakai menu —</option>
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Qty paket</label>
            <input
              className="input"
              type="number"
              min={0.001}
              step="0.001"
              value={qtyPaket}
              onChange={(e) => setQtyPaket(e.target.value)}
              disabled={!menuId}
            />
          </div>
          <div className="field">
            <label className="label">Item tambahan (opsional)</label>
            <select
              className="input select"
              value={extraItemId}
              onChange={(e) => setExtraItemId(e.target.value)}
            >
              <option value="">—</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.sku} — {it.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Qty item tambahan</label>
            <input
              className="input"
              type="number"
              min={0.001}
              step="0.001"
              value={extraQty}
              onChange={(e) => setExtraQty(e.target.value)}
              disabled={!extraItemId}
            />
          </div>
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
              {saving ? "Mengirim…" : "Ajukan"}
            </button>
          </div>
        </form>
      </Drawer>

      {!showKitchenUi && !showWarehouseUi ? (
        <p className="muted">Anda hanya dapat melihat daftar permintaan.</p>
      ) : null}
    </div>
  );
}

export default function StockRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="si-page">
          <div className="si-empty">
            <p className="muted">Memuat…</p>
          </div>
        </div>
      }
    >
      <StockRequestsContent />
    </Suspense>
  );
}
