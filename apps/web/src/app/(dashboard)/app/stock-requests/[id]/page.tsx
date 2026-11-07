"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ShortageList } from "@/components/features/ShortageList";
import { ShortageDetail, shortageDetails } from "@/lib/api";
import { getUser } from "@/lib/auth";
import {
  parseRequestFocus,
  showKitchenRequestActions,
  showWarehouseRequestActions,
} from "@/lib/rbac";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  requestStatusBadge,
  requestStatusLabel,
  StockRequest,
  transferApi,
} from "@/lib/transfer";
import { warehouseApi } from "@/lib/warehouse";

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

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
      return "Status: diterima. Persediaan dapur sudah bertambah.";
    case "rejected":
      return "Status: ditolak.";
    case "cancelled":
      return "Status: dibatalkan oleh dapur.";
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
  const [shortages, setShortages] = useState<ShortageDetail[] | null>(null);
  const [shortageTitle, setShortageTitle] = useState("");
  // mode: which inline form is open
  const [mode, setMode] = useState<"none" | "transfer" | "receive">("none");
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [whStock, setWhStock] = useState<Record<string, number>>({});

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
    setShortages(null);
    try {
      const updated = await action();
      setReq(updated);
      setMode("none");
      toastSuccess(okMsg);
      return true;
    } catch (e) {
      const short = shortageDetails(e);
      if (short) {
        setShortages(short);
        setShortageTitle(e instanceof Error ? e.message : "Persediaan kurang");
      }
      toastError(e instanceof Error ? e.message : "Aksi gagal");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function approve(allowShortage: boolean) {
    if (!req) return;
    await run(
      () => transferApi.approve(req.id, allowShortage),
      allowShortage ? "Disetujui dengan kekurangan" : "Permintaan disetujui",
    );
  }

  async function askReason(
    label: string,
    action: (reason: string) => Promise<StockRequest>,
    okMsg: string,
  ) {
    const reason = window.prompt(label);
    if (!reason?.trim()) return;
    await run(() => action(reason.trim()), okMsg);
  }

  async function openTransfer() {
    if (!req) return;
    setShortages(null);
    let stocks: Record<string, number> = {};
    try {
      const rows = await warehouseApi.listStocks();
      stocks = Object.fromEntries(rows.map((r) => [r.item_id, Number(r.qty)]));
    } catch {
      // stock indicator is best-effort; the API still validates
    }
    setWhStock(stocks);
    const draft: Record<string, string> = {};
    for (const l of req.lines ?? []) {
      const avail = stocks[l.item_id];
      draft[l.id] = String(avail === undefined ? l.qty : round3(Math.min(l.qty, avail)));
    }
    setQtyDraft(draft);
    setMode("transfer");
  }

  function openReceive() {
    if (!req) return;
    setShortages(null);
    const draft: Record<string, string> = {};
    for (const l of req.lines ?? []) draft[l.id] = String(l.qty_transferred ?? 0);
    setQtyDraft(draft);
    setNoteDraft({});
    setMode("receive");
  }

  async function submitTransfer() {
    if (!req) return;
    const lines = (req.lines ?? []).map((l) => ({
      line_id: l.id,
      qty: Number(qtyDraft[l.id] ?? l.qty),
    }));
    if (lines.some((l) => Number.isNaN(l.qty) || l.qty < 0)) {
      toastError("Jumlah kirim tidak valid");
      return;
    }
    if (!lines.some((l) => l.qty > 0)) {
      toastError("Minimal satu baris harus dikirim");
      return;
    }
    await run(() => transferApi.transfer(req.id, lines), "Persediaan gudang dikurangi (transfer)");
  }

  async function submitReceive() {
    if (!req) return;
    const lines = (req.lines ?? []).map((l) => ({
      line_id: l.id,
      qty_received: Number(qtyDraft[l.id] ?? l.qty_transferred ?? 0),
      note: noteDraft[l.id]?.trim() || null,
    }));
    for (const [i, l] of lines.entries()) {
      const sent = req.lines?.[i].qty_transferred ?? 0;
      if (Number.isNaN(l.qty_received) || l.qty_received < 0 || l.qty_received > sent) {
        toastError("Jumlah terima harus antara 0 dan jumlah dikirim");
        return;
      }
      if (l.qty_received !== sent && !l.note) {
        toastError(`Catatan wajib untuk ${req.lines?.[i].item_name} (jumlah berbeda)`);
        return;
      }
    }
    await run(() => transferApi.receive(req.id, lines), "Persediaan dapur bertambah (diterima)");
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
            No. {shortId(req.id)} ·{" "}
            <span className={requestStatusBadge(req.status)}>
              {requestStatusLabel(req.status)}
            </span>
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
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void approve(false)}
            >
              Setujui
            </button>
          ) : null}
          {showWarehouseUi && req.status === "submitted" && shortages ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void approve(true)}
            >
              Tetap setujui (kirim parsial nanti)
            </button>
          ) : null}
          {showWarehouseUi && (req.status === "submitted" || req.status === "approved") ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() =>
                void askReason(
                  "Alasan penolakan",
                  (reason) => transferApi.reject(req.id, reason),
                  "Permintaan ditolak",
                )
              }
            >
              Tolak
            </button>
          ) : null}
          {showWarehouseUi && req.status === "approved" && mode !== "transfer" ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void openTransfer()}
            >
              Transfer dari gudang
            </button>
          ) : null}
          {showKitchenUi && (req.status === "submitted" || req.status === "approved") ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() =>
                void askReason(
                  "Alasan pembatalan",
                  (reason) => transferApi.cancel(req.id, reason),
                  "Permintaan dibatalkan",
                )
              }
            >
              Batalkan
            </button>
          ) : null}
          {showKitchenUi && req.status === "transferred" && mode !== "receive" ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={openReceive}
            >
              Konfirmasi terima
            </button>
          ) : null}
        </div>
      </div>

      {shortages && shortages.length > 0 ? (
        <div className="no-print">
          <ShortageList items={shortages} title={shortageTitle} />
        </div>
      ) : null}

      {mode !== "none" ? (
        <section className="si-table-card no-print">
          <h2 className="panel-title">
            {mode === "transfer" ? "Jumlah dikirim per baris" : "Jumlah diterima per baris"}
          </h2>
          <p className="muted">
            {mode === "transfer"
              ? "Default penuh, dibatasi stok gudang. Sisa yang tidak dikirim dianggap selesai; dapur mengajukan permintaan baru bila perlu."
              : "Default sama dengan yang dikirim. Catatan wajib bila jumlah berbeda; selisih dicatat sebagai selisih pengiriman."}
          </p>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Diminta</th>
                  {mode === "transfer" ? <th>Stok gudang</th> : <th>Dikirim</th>}
                  <th>{mode === "transfer" ? "Kirim" : "Diterima"}</th>
                  {mode === "receive" ? <th>Catatan</th> : null}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const avail = whStock[l.item_id];
                  const shortLine = mode === "transfer" && avail !== undefined && avail < l.qty;
                  const sent = l.qty_transferred ?? 0;
                  const draftQty = Number(qtyDraft[l.id]);
                  const differs = mode === "receive" && draftQty !== sent;
                  return (
                    <tr key={l.id}>
                      <td>
                        <strong>{l.item_sku}</strong> — {l.item_name}
                      </td>
                      <td>
                        {l.qty} {l.unit_code}
                      </td>
                      <td>
                        {mode === "transfer" ? (
                          <>
                            {avail ?? "—"}{" "}
                            {shortLine ? <span className="badge badge-warn">kurang</span> : null}
                          </>
                        ) : (
                          `${sent} ${l.unit_code}`
                        )}
                      </td>
                      <td>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step="0.001"
                          max={mode === "transfer" ? l.qty : sent}
                          value={qtyDraft[l.id] ?? ""}
                          onChange={(e) =>
                            setQtyDraft((d) => ({ ...d, [l.id]: e.target.value }))
                          }
                        />
                      </td>
                      {mode === "receive" ? (
                        <td>
                          <input
                            className="input"
                            placeholder={differs ? "Wajib: alasan selisih" : "Opsional"}
                            value={noteDraft[l.id] ?? ""}
                            onChange={(e) =>
                              setNoteDraft((d) => ({ ...d, [l.id]: e.target.value }))
                            }
                          />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="drawer-footer">
            <button type="button" className="btn btn-ghost" onClick={() => setMode("none")}>
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void (mode === "transfer" ? submitTransfer() : submitReceive())}
            >
              {mode === "transfer" ? "Kirim & kurangi stok gudang" : "Konfirmasi terima"}
            </button>
          </div>
        </section>
      ) : null}

      <article className="si-doc" id="request-print">
        <header className="si-doc-kop">
          <p className="si-doc-brand">Dapoer Sari</p>
          <p className="si-doc-org">Sistem manajemen inventaris</p>
        </header>

        <h2 className="si-doc-title">Berita acara permintaan persediaan</h2>

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
          {req.cancelled_at ? (
            <div className="si-doc-meta-row">
              <dt>Dibatalkan</dt>
              <dd>{formatDateTime(req.cancelled_at)}</dd>
            </div>
          ) : null}
        </dl>

        <p className="si-doc-lead">
          Pada tanggal {formatDateTime(req.created_at)} dapur mengajukan
          permintaan persediaan kepada gudang dengan rincian paket dan item
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

        {req.cancel_reason ? (
          <p className="si-doc-note">
            <strong>Alasan pembatalan:</strong> {req.cancel_reason}
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
                <th>Diminta</th>
                <th>Dikirim</th>
                <th>Diterima</th>
                <th>Catatan terima</th>
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
                  <td>
                    {l.qty_transferred ?? "—"}
                    {l.qty_transferred != null && l.qty_transferred < l.qty ? " (parsial)" : ""}
                  </td>
                  <td>
                    {l.qty_received ?? "—"}
                    {l.qty_received != null && l.qty_transferred != null && l.qty_received !== l.qty_transferred
                      ? ` (selisih ${round3(l.qty_received - l.qty_transferred)})`
                      : ""}
                  </td>
                  <td>{l.receive_note || "—"}</td>
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
