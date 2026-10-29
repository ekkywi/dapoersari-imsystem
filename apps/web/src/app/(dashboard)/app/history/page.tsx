"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  activityActionLabel,
  ActivityEntry,
  historyApi,
  StockHistoryEntry,
  stockReasonLabel,
} from "@/lib/history";
import { toastError } from "@/lib/toast";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function refHref(
  refType?: string | null,
  refId?: string | null,
  location?: string,
): string | null {
  if (!refType || !refId) return null;
  if (refType === "opname") {
    const focus =
      location === "kitchen" || location === "warehouse"
        ? `?focus=${location}`
        : "";
    return `/app/opnames/${refId}${focus}`;
  }
  if (refType === "menu_closing") {
    return `/app/kitchen/closings`;
  }
  if (refType === "stock_request") {
    return `/app/stock-requests/${refId}`;
  }
  return null;
}

function entityHref(
  entityType?: string | null,
  entityId?: string | null,
): string | null {
  if (!entityType || !entityId) return null;
  if (entityType === "opname") return `/app/opnames/${entityId}`;
  if (entityType === "menu_closing") return `/app/kitchen/closings`;
  return null;
}

export default function HistoryPage() {
  const [tab, setTab] = useState<"stock" | "activity">("stock");
  const [location, setLocation] = useState("");
  const [stockRows, setStockRows] = useState<StockHistoryEntry[]>([]);
  const [activityRows, setActivityRows] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "stock") {
        setStockRows(
          await historyApi.listStock({
            location: location || undefined,
            limit: 100,
          }),
        );
      } else {
        setActivityRows(await historyApi.listActivity(100));
      }
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat riwayat");
    } finally {
      setLoading(false);
    }
  }, [tab, location]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Audit</p>
          <h1 className="page-title">Riwayat</h1>
          <p className="lede">
            Jejak mutasi stok dan aktivitas penting (closing, opname, dll.).
          </p>
        </div>
      </header>

      <div className="si-filter-row" role="group" aria-label="Jenis riwayat">
        <button
          type="button"
          className={tab === "stock" ? "si-filter-chip is-active" : "si-filter-chip"}
          onClick={() => setTab("stock")}
        >
          Mutasi stok
        </button>
        <button
          type="button"
          className={
            tab === "activity" ? "si-filter-chip is-active" : "si-filter-chip"
          }
          onClick={() => setTab("activity")}
        >
          Aktivitas
        </button>
      </div>

      <div className="si-toolbar">
        <div className="si-toolbar-meta">
          {tab === "stock" ? (
            <select
              className="input select"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              aria-label="Filter lokasi"
            >
              <option value="">Semua lokasi</option>
              <option value="warehouse">Gudang</option>
              <option value="kitchen">Dapur</option>
            </select>
          ) : (
            <p className="si-count">
              <strong>{activityRows.length}</strong> entri
            </p>
          )}
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
        ) : tab === "stock" ? (
          stockRows.length === 0 ? (
            <div className="si-empty">
              <p className="si-empty-title">Belum ada mutasi</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Lokasi</th>
                    <th>Item</th>
                    <th>Delta</th>
                    <th>Setelah</th>
                    <th>Alasan</th>
                    <th>Dokumen</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((r) => {
                    const href = refHref(r.ref_type, r.ref_id, r.location);
                    return (
                      <tr key={r.id}>
                        <td>{formatDateTime(r.created_at)}</td>
                        <td>{r.location === "kitchen" ? "Dapur" : "Gudang"}</td>
                        <td>
                          <strong>{r.item_sku}</strong> — {r.item_name} (
                          {r.unit_code})
                        </td>
                        <td>{r.delta}</td>
                        <td>{r.qty_after}</td>
                        <td>{stockReasonLabel(r.reason)}</td>
                        <td>
                          {href ? (
                            <Link className="btn btn-ghost" href={href}>
                              Buka
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activityRows.length === 0 ? (
          <div className="si-empty">
            <p className="si-empty-title">Belum ada aktivitas</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aksi</th>
                  <th>Entitas</th>
                  <th>Detail</th>
                  <th>Dokumen</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.map((r) => {
                  const href = entityHref(r.entity_type, r.entity_id);
                  return (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.created_at)}</td>
                      <td>{activityActionLabel(r.action)}</td>
                      <td>
                        {r.entity_type ?? "—"}
                        {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}…` : ""}
                      </td>
                      <td>{r.detail || "—"}</td>
                      <td>
                        {href ? (
                          <Link className="btn btn-ghost" href={href}>
                            Buka
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
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
