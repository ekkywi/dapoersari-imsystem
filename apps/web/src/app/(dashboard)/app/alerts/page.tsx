"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  alertLevelLabel,
  dashboardApi,
  locationLabel,
  LowStockAlert,
} from "@/lib/dashboard";
import { toastError } from "@/lib/toast";

function AlertsContent() {
  const searchParams = useSearchParams();
  const locationParam = searchParams.get("location") ?? "";
  const location =
    locationParam === "warehouse" || locationParam === "kitchen"
      ? locationParam
      : "";

  const [rows, setRows] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await dashboardApi.lowStock(location || undefined));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat alert");
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.sku.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.category_name ?? "").toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Operasional</p>
          <h1 className="page-title">Peringatan Persediaan</h1>
          <p className="lede">Item di bawah min stok (gudang &amp; dapur).</p>
        </div>
        <div className="page-header-actions">
          <Link className="btn btn-ghost" href="/app">
            Ringkasan
          </Link>
        </div>
      </header>

      <div className="si-filter-row" role="group" aria-label="Lokasi">
        <Link
          href="/app/alerts"
          className={!location ? "si-filter-chip is-active" : "si-filter-chip"}
        >
          Semua
        </Link>
        <Link
          href="/app/alerts?location=warehouse"
          className={
            location === "warehouse" ? "si-filter-chip is-active" : "si-filter-chip"
          }
        >
          Gudang
        </Link>
        <Link
          href="/app/alerts?location=kitchen"
          className={
            location === "kitchen" ? "si-filter-chip is-active" : "si-filter-chip"
          }
        >
          Dapur
        </Link>
      </div>

      <div className="si-toolbar">
        <div className="si-toolbar-meta">
          <p className="si-count">
            <strong>{filtered.length}</strong> Peringatan
          </p>
          <input
            className="input si-search"
            type="search"
            placeholder="Cari SKU / nama…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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
            <p className="muted">Memuat…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="si-empty">
            <p className="si-empty-title">Tidak ada peringatan</p>
            <p className="si-empty-desc">Tidak ada item di bawah persediaan minimum.</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Lokasi</th>
                  <th>SKU</th>
                  <th>Nama</th>
                  <th>Kategori</th>
                  <th>On-hand</th>
                  <th>In-transit</th>
                  <th>Effective</th>
                  <th>Min</th>
                  <th>Satuan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={`${r.location}-${r.item_id}`}>
                    <td>
                      <span
                        className={
                          r.level === "critical"
                            ? "badge badge-danger"
                            : "badge badge-warn"
                        }
                      >
                        {alertLevelLabel(r.level)}
                      </span>
                    </td>
                    <td>{locationLabel(r.location)}</td>
                    <td>
                      <strong>{r.sku}</strong>
                    </td>
                    <td>{r.name}</td>
                    <td>{r.category_name || "—"}</td>
                    <td>{r.qty}</td>
                    <td>{r.in_transit}</td>
                    <td>{r.effective_qty}</td>
                    <td>{r.min_stock}</td>
                    <td>{r.unit_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AlertsPage() {
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
      <AlertsContent />
    </Suspense>
  );
}
