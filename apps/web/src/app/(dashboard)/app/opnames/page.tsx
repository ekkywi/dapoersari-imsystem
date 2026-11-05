"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { ApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { kitchenApi, KitchenStock } from "@/lib/kitchen";
import {
  parseRequestFocus,
  showOpnameMutate,
  type RequestFocus,
} from "@/lib/rbac";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  Opname,
  opnameApi,
  opnameLocationLabel,
  opnameStatusLabel,
} from "@/lib/opname";
import { Item, Unit, WarehouseStock, warehouseApi } from "@/lib/warehouse";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type DraftLine = { item_id: string; physical_qty: string; system_qty: number };

function OpnamesContent() {
  const searchParams = useSearchParams();
  const focus = parseRequestFocus(searchParams.get("focus"));
  const location: RequestFocus | null = focus;

  const [rows, setRows] = useState<Opname[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [whStocks, setWhStocks] = useState<WarehouseStock[]>([]);
  const [kitStocks, setKitStocks] = useState<KitchenStock[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [canMutate, setCanMutate] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);

  const unitMap = useMemo(
    () => Object.fromEntries(units.map((u) => [u.id, u.code])),
    [units],
  );
  const itemMap = useMemo(
    () => Object.fromEntries(items.map((it) => [it.id, it])),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.status.toLowerCase().includes(q) ||
        (r.note ?? "").toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const load = useCallback(async () => {
    try {
      const loc = location ?? undefined;
      const [opnames, itemRows, unitRows, wh, kit] = await Promise.all([
        opnameApi.list(loc),
        warehouseApi.listItems(),
        warehouseApi.listUnits(),
        warehouseApi.listStocks(),
        kitchenApi.listStocks(),
      ]);
      setRows(opnames);
      setItems(itemRows);
      setUnits(unitRows);
      setWhStocks(wh);
      setKitStocks(kit);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat opname");
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    const user = getUser();
    setCanMutate(user ? showOpnameMutate(user.role, focus) : false);
    void load();
  }, [load, focus]);

  function systemQtyFor(itemId: string): number {
    if (location === "kitchen") {
      return kitStocks.find((s) => s.item_id === itemId)?.qty ?? 0;
    }
    return whStocks.find((s) => s.item_id === itemId)?.qty ?? 0;
  }

  function openCreate() {
    if (!location) return;
    const activeItems = items.filter((it) => it.is_active);
    setDraftLines(
      activeItems.slice(0, 8).map((it) => ({
        item_id: it.id,
        physical_qty: String(systemQtyFor(it.id)),
        system_qty: systemQtyFor(it.id),
      })),
    );
    setNote("");
    setFormError(null);
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canMutate || !location) return;
    const lines = draftLines
      .map((l) => ({
        item_id: l.item_id,
        physical_qty: Number(l.physical_qty),
      }))
      .filter((l) => l.item_id && Number.isFinite(l.physical_qty) && l.physical_qty >= 0);
    if (lines.length === 0) {
      setFormError("Minimal satu item dengan qty fisik");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body = { location, note: note.trim() || null, lines };
      try {
        await opnameApi.create(body);
      } catch (err) {
        if (!(err instanceof ApiError && err.code === "closing_missing")) throw err;
        const go = window.confirm(
          "Belum ada akhir shift (closing) dapur untuk hari ini. Sebaiknya lakukan closing dulu, lalu hitung fisik, baru buat draf.\n\nPeringatan: closing yang dicatat SETELAH draf ini akan membuat draf tidak bisa dikonfirmasi.\n\nTetap buat draf sekarang?",
        );
        if (!go) return;
        await opnameApi.create({ ...body, acknowledge_no_closing: true });
      }
      setDrawerOpen(false);
      toastSuccess("Draf opname dibuat — konfirmasi di detail");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal membuat opname");
    } finally {
      setSaving(false);
    }
  }

  const title =
    location === "warehouse"
      ? "Opname gudang"
      : location === "kitchen"
        ? "Opname dapur"
        : "Opname";
  const sectionLabel =
    location === "warehouse"
      ? "Gudang"
      : location === "kitchen"
        ? "Dapur"
        : "Inventaris";

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">{sectionLabel}</p>
          <h1 className="page-title">{title}</h1>
          <p className="lede">Hitung fisik versus persediaan sistem.</p>
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
          {canMutate && location ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Buat opname
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
            <p className="si-empty-title">Belum ada opname</p>
            <p className="si-empty-desc">Belum ada dokumen opname.</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Lokasi</th>
                  <th>Status</th>
                  <th>Catatan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td>{opnameLocationLabel(r.location)}</td>
                    <td>
                      <span className="badge badge-neutral">
                        {opnameStatusLabel(r.status)}
                      </span>
                    </td>
                    <td>{r.note || "—"}</td>
                    <td>
                      <Link
                        className="btn btn-ghost"
                        href={
                          focus
                            ? `/app/opnames/${r.id}?focus=${focus}`
                            : `/app/opnames/${r.id}`
                        }
                      >
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
        title="Buat opname"
        description="Isi qty fisik per item."
        onClose={() => setDrawerOpen(false)}
      >
        {formError ? <p className="error">{formError}</p> : null}
        <form className="form" onSubmit={onSubmit}>
          {draftLines.map((line, idx) => {
            const item = itemMap[line.item_id];
            const unit = item ? unitMap[item.unit_id] ?? "" : "";
            return (
              <div key={line.item_id || idx} className="field">
                <label className="label">
                  {item ? `${item.sku} — ${item.name}` : "Item"} ({unit}) · sistem{" "}
                  {line.system_qty}
                </label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.001"
                  value={line.physical_qty}
                  onChange={(e) => {
                    const next = [...draftLines];
                    next[idx] = { ...line, physical_qty: e.target.value };
                    setDraftLines(next);
                  }}
                />
              </div>
            );
          })}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const used = new Set(draftLines.map((l) => l.item_id));
              const nextItem = items.find(
                (it) => it.is_active && !used.has(it.id),
              );
              if (!nextItem) {
                toastError("Semua item sudah ditambahkan");
                return;
              }
              setDraftLines((prev) => [
                ...prev,
                {
                  item_id: nextItem.id,
                  physical_qty: String(systemQtyFor(nextItem.id)),
                  system_qty: systemQtyFor(nextItem.id),
                },
              ]);
            }}
          >
            + Tambah item
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
              {saving ? "Menyimpan…" : "Simpan draf"}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}

export default function OpnamesPage() {
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
      <OpnamesContent />
    </Suspense>
  );
}
