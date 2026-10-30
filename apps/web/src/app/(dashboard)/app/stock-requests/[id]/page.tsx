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

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function statusFootnote(status: string): string {
  switch (status) {
    case "submitted":
      return "Status: diajukan. Menunggu persetujuan gudang.";
    case "approved":
      return "Status: disetujui. Menunggu pengiriman dari gudang.";
    case "transferred":
      return "Status: ditransfer. Menunggu konfirmasi terima dapur.";
    case "received":
      return "Status: diterima. Stok dapur sudah bertambah.";
    case "rejected":
      return "Status: ditolak.";
    default:
      return `Status: ${status}`;
  }
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
  const packages = req.packages ?? [];
  const lines = req.lines ?? [];

  return (
    <div className="si-page">
      <header className="si-page-header no-print">
        <div className="page-header-text">
          <p className="section-label">{sectionLabel}</p>
          <h1 className="page-title">Dokumen permintaan</h1>
          <p className="lede">
            No. {shortId(req.id)} · {requestStatusLabel(req.status)}
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn btn-ghost" href={listHref}>
            Kembali
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => window.print()}
          >
            Cetak
          </button>
        </div>
      </header>

      <div className="si-toolbar no-print">
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

      <article className="si-doc" id="request-print">
        <header className="si-doc-kop">
          <p className="si-doc-brand">Dapoer Sari</p>
          <p className="si-doc-org">Sistem manajemen inventaris</p>
        </header>

        <h2 className="si-doc-title">Berita acara permintaan stok</h2>

        <dl className="si-doc-meta-grid">
          <div className="si-doc-meta-row">
            <dt>Nomor</dt>
            <dd>{shortId(req.id)}</dd>
          </div>
          <div className="si-doc-meta-row">
            <dt>Status</dt>
            <dd>{requestStatusLabel(req.status)}</dd>
          </div>
          <div className="si-doc-meta-row">
            <dt>Diajukan</dt>
            <dd>{formatDateTime(req.created_at)}</dd>
          </div>
          {req.approved_at ? (
            <div className="si-doc-meta-row">
              <dt>Disetujui</dt>
              <dd>{formatDateTime(req.approved_at)}</dd>
            </div>
          ) : null}
          {req.transferred_at ? (
            <div className="si-doc-meta-row">
              <dt>Ditransfer</dt>
              <dd>{formatDateTime(req.transferred_at)}</dd>
            </div>
          ) : null}
          {req.received_at ? (
            <div className="si-doc-meta-row">
              <dt>Diterima</dt>
              <dd>{formatDateTime(req.received_at)}</dd>
            </div>
          ) : null}
          {req.rejected_at ? (
            <div className="si-doc-meta-row">
              <dt>Ditolak</dt>
              <dd>{formatDateTime(req.rejected_at)}</dd>
            </div>
          ) : null}
        </dl>

        <p className="si-doc-lead">
          Pada tanggal {formatDateTime(req.created_at)} dapur mengajukan
          permintaan stok kepada gudang dengan rincian paket dan item
          sebagaimana tercantum dalam berita acara ini.
        </p>

        {req.note ? (
          <p className="si-doc-note">
            <strong>Catatan:</strong> {req.note}
          </p>
        ) : null}

        {req.reject_reason ? (
          <p className="si-doc-note">
            <strong>Alasan penolakan:</strong> {req.reject_reason}
          </p>
        ) : null}

        <p className="si-doc-summary-line">
          <strong>Ringkasan:</strong> {packages.length} paket menu ·{" "}
          {lines.length} baris item
        </p>

        <h3 className="si-doc-section-title">Ringkasan paket</h3>
        {packages.length === 0 ? (
          <p className="si-doc-note muted">
            Tidak ada paket menu (permintaan by item).
          </p>
        ) : (
          <div className="data-table-wrap si-doc-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="si-doc-col-num">No</th>
                  <th>Menu</th>
                  <th>Qty paket</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((p, i) => (
                  <tr key={p.id}>
                    <td className="si-doc-col-num">{i + 1}</td>
                    <td>{p.menu_name}</td>
                    <td>{p.qty_paket}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className="si-doc-section-title">Rincian item</h3>
        <div className="data-table-wrap si-doc-table">
          <table className="data-table">
            <thead>
              <tr>
                <th className="si-doc-col-num">No</th>
                <th>SKU</th>
                <th>Nama</th>
                <th>Kategori</th>
                <th>Satuan</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id}>
                  <td className="si-doc-col-num">{i + 1}</td>
                  <td>
                    <strong>{l.item_sku}</strong>
                  </td>
                  <td>{l.item_name}</td>
                  <td>{l.category_name || "—"}</td>
                  <td>{l.unit_code}</td>
                  <td>{l.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="si-doc-closing">
          {statusFootnote(req.status)} Demikian berita acara ini dibuat untuk
          dipergunakan sebagaimana mestinya.
        </p>

        <footer className="si-doc-foot">
          <div className="si-doc-signs is-triple">
            <div>
              <p className="si-doc-sign-label">Pemohon (dapur)</p>
              <p className="si-doc-sign-line">________________</p>
              <p className="si-doc-sign-caption">Nama &amp; tanda tangan</p>
            </div>
            <div>
              <p className="si-doc-sign-label">Gudang</p>
              <p className="si-doc-sign-line">________________</p>
              <p className="si-doc-sign-caption">Nama &amp; tanda tangan</p>
            </div>
            <div>
              <p className="si-doc-sign-label">Penerima (dapur)</p>
              <p className="si-doc-sign-line">________________</p>
              <p className="si-doc-sign-caption">Nama &amp; tanda tangan</p>
            </div>
          </div>
        </footer>
      </article>
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
