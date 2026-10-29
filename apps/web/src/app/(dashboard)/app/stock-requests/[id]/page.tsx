"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { getUser } from "@/lib/auth";
import {
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function StockRequestDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const focus = parseRequestFocus(searchParams.get("focus"));

  const [req, setReq] = useState<StockRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showKitchenUi, setShowKitchenUi] = useState(false);
  const [showWarehouseUi, setShowWarehouseUi] = useState(false);

  const listHref = focus
    ? `/app/stock-requests?focus=${focus}`
    : "/app/stock-requests";

  const load = useCallback(async () => {
    try {
      setReq(await transferApi.get(id));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat detail");
      setReq(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const user = getUser();
    if (user) {
      setShowKitchenUi(showKitchenRequestActions(user.role, focus));
      setShowWarehouseUi(showWarehouseRequestActions(user.role, focus));
    }
    void load();
  }, [load, focus]);

  async function run(
    action: () => Promise<StockRequest>,
    okMsg: string,
  ) {
    setBusy(true);
    try {
      const updated = await action();
      setReq(updated);
      toastSuccess(okMsg);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Aksi gagal");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="si-page">
        <p className="muted">Memuat…</p>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="si-page">
        <p className="error">Permintaan tidak ditemukan</p>
        <Link className="btn btn-ghost" href={listHref}>
          Kembali
        </Link>
      </div>
    );
  }

  const sectionLabel =
    focus === "warehouse" ? "Gudang" : focus === "kitchen" ? "Dapur" : "Transfer";

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">{sectionLabel}</p>
          <h1 className="page-title">Detail permintaan</h1>
          <p className="lede">
            Diajukan {formatDateTime(req.created_at)} ·{" "}
            <span className="badge badge-neutral">
              {requestStatusLabel(req.status)}
            </span>
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn btn-ghost" href={listHref}>
            Kembali
          </Link>
        </div>
      </header>

      <div className="si-toolbar">
        <div className="si-toolbar-meta">
          <p className="si-count">{req.note || "Tanpa catatan"}</p>
        </div>
        <div className="si-toolbar-actions">
          {showWarehouseUi && req.status === "submitted" ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  void run(() => transferApi.approve(req.id), "Permintaan disetujui")
                }
              >
                Setujui
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt("Alasan penolakan");
                  if (!reason?.trim()) return;
                  void run(
                    () => transferApi.reject(req.id, reason.trim()),
                    "Permintaan ditolak",
                  );
                }}
              >
                Tolak
              </button>
            </>
          ) : null}
          {showWarehouseUi && req.status === "approved" ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => transferApi.transfer(req.id),
                  "Stok gudang dikurangi (transfer)",
                )
              }
            >
              Transfer dari gudang
            </button>
          ) : null}
          {showKitchenUi && req.status === "transferred" ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => transferApi.receive(req.id),
                  "Stok dapur bertambah (diterima)",
                )
              }
            >
              Konfirmasi terima
            </button>
          ) : null}
        </div>
      </div>

      <section className="si-table-card">
        <div style={{ padding: "0.75rem 1rem 0" }}>
          <h2 className="panel-title">Ringkasan paket</h2>
        </div>
        {(req.packages?.length ?? 0) === 0 ? (
          <div className="si-empty">
            <p className="muted">Tidak ada paket menu (permintaan by item).</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Menu</th>
                  <th>Qty paket</th>
                </tr>
              </thead>
              <tbody>
                {req.packages!.map((p) => (
                  <tr key={p.id}>
                    <td>{p.menu_name}</td>
                    <td>{p.qty_paket}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="si-table-card">
        <div style={{ padding: "0.75rem 1rem 0" }}>
          <h2 className="panel-title">Rincian item (snapshot)</h2>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nama</th>
                <th>Satuan</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {(req.lines ?? []).map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.item_sku}</strong>
                  </td>
                  <td>{l.item_name}</td>
                  <td>{l.unit_code}</td>
                  <td>{l.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function StockRequestDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="si-page">
          <p className="muted">Memuat…</p>
        </div>
      }
    >
      <StockRequestDetailContent />
    </Suspense>
  );
}
