"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getUser } from "@/lib/auth";
import {
  dashboardApi,
  DashboardSummary,
} from "@/lib/dashboard";
import { canMutateKitchen, canMutateWarehouse } from "@/lib/rbac";
import { toastError } from "@/lib/toast";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");

  const load = useCallback(async () => {
    try {
      setSummary(await dashboardApi.summary());
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat ringkasan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setRole(user?.role ?? "");
    void load();
  }, [load]);

  const showWh = canMutateWarehouse(role);
  const showKit = canMutateKitchen(role);

  const totalLow =
    (summary?.warehouse_low_stock ?? 0) + (summary?.kitchen_low_stock ?? 0);

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Operasional</p>
          <h1 className="page-title">Ringkasan</h1>
          <p className="lede">Status stok dan antrian dokumen.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Muat ulang
          </button>
          <Link className="btn btn-primary" href="/app/alerts">
            Lihat alert
          </Link>
        </div>
      </header>

      {loading || !summary ? (
        <div className="si-empty">
          <p className="muted">Memuat ringkasan…</p>
        </div>
      ) : (
        <>
          <div className="badge-row badge-row-spaced" style={{ marginBottom: "1rem" }}>
            {totalLow === 0 ? (
              <span className="badge badge-success">Stok dalam ambang</span>
            ) : (
              <span className="badge badge-warn">{totalLow} item perlu perhatian</span>
            )}
            {summary.in_transit_requests > 0 ? (
              <span className="badge badge-neutral">
                {summary.in_transit_requests} dalam perjalanan
              </span>
            ) : null}
            {summary.pending_approvals > 0 ? (
              <span className="badge badge-danger">
                {summary.pending_approvals} menunggu persetujuan
              </span>
            ) : null}
          </div>

          <div className="stat-grid">
            <article className="stat-card">
              <p className="stat-label">Gudang · di bawah min</p>
              <p className="stat-value">{summary.warehouse_low_stock}</p>
              <p className="stat-hint">
                <Link href="/app/alerts?location=warehouse">Lihat alert gudang</Link>
              </p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Dapur · di bawah min*</p>
              <p className="stat-value">{summary.kitchen_low_stock}</p>
              <p className="stat-hint">
                <Link href="/app/alerts?location=kitchen">Lihat alert dapur</Link>
              </p>
            </article>
            {showWh ? (
              <article className="stat-card">
                <p className="stat-label">Menunggu persetujuan</p>
                <p className="stat-value">{summary.pending_approvals}</p>
                <p className="stat-hint">
                  <Link href="/app/stock-requests?focus=warehouse">Antrian permintaan</Link>
                </p>
              </article>
            ) : null}
            {showWh ? (
              <article className="stat-card">
                <p className="stat-label">Siap ditransfer</p>
                <p className="stat-value">{summary.awaiting_transfer}</p>
                <p className="stat-hint">Status disetujui</p>
              </article>
            ) : null}
            {showKit ? (
              <article className="stat-card">
                <p className="stat-label">Dalam perjalanan</p>
                <p className="stat-value">{summary.in_transit_requests}</p>
                <p className="stat-hint">
                  <Link href="/app/stock-requests?focus=kitchen">Menunggu terima</Link>
                </p>
              </article>
            ) : null}
            <article className="stat-card">
              <p className="stat-label">Katalog aktif</p>
              <p className="stat-value">{summary.active_items}</p>
              <p className="stat-hint">{summary.active_menus} menu aktif</p>
            </article>
          </div>

          <p className="muted" style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
            *Dapur: stok on-hand + dalam perjalanan. Lead{" "}
            {summary.lead_time_days} hari · interval {summary.order_interval_days}{" "}
            hari.
          </p>
        </>
      )}
    </div>
  );
}
