"use client";

import { useParams, useSearchParams } from "next/navigation";
<<<<<<< HEAD
import { Suspense, useCallback, useEffect, useState } from "react";
import { ShortageList } from "@/components/features/ShortageList";
import { ShortageDetail, shortageDetails } from "@/lib/api";
=======
import {
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RouteRail, type RouteStep } from "@/components/features/RouteRail";
import { Button, LinkButton } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { Qty } from "@/components/ui/Qty";
import { StatusChip } from "@/components/ui/StatusChip";
>>>>>>> origin/feat/web-redesign
import { getUser } from "@/lib/auth";
import { formatClock, formatDay, formatFullStamp, formatStamp } from "@/lib/datetime";
import { docNo, formatQty } from "@/lib/format";
import {
  parseRequestFocus,
  showKitchenRequestActions,
  showWarehouseRequestActions,
} from "@/lib/rbac";
<<<<<<< HEAD
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
=======
import { checkLines, shortages, type LineCheck } from "@/lib/request-stock";
import { toastSuccess } from "@/lib/toast";
import { requestStatusLabel, StockRequest, transferApi } from "@/lib/transfer";
import { warehouseApi } from "@/lib/warehouse";
>>>>>>> origin/feat/web-redesign

const QUICK_REASONS = [
  "Stok gudang tidak cukup",
  "Duplikat permintaan",
  "Salah pilih menu atau jumlah",
] as const;

type ActionKey = "approve" | "reject" | "transfer" | "receive";

const BUSY_LABEL: Record<ActionKey, string> = {
  approve: "Menyetujui…",
  reject: "Menolak…",
  transfer: "Mengirim…",
  receive: "Mengonfirmasi…",
};

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

/** Turns the API's terse 409 messages into something the operator can act on. */
function explainActionError(message: string): { title: string; body: string } {
  if (message.includes("tidak mencukupi")) {
    return {
      title: "Stok gudang tidak cukup untuk mengirim",
      body: "Stok gudang berubah sejak halaman ini dibuka. Muat ulang untuk melihat stok terbaru, atau catat persediaan masuk dulu.",
    };
  }
  if (message.includes("status permintaan tidak sesuai")) {
    return {
      title: "Status permintaan sudah berubah",
      body: "Dokumen ini mungkin sudah diproses orang lain. Muat ulang untuk melihat keadaan terbarunya.",
    };
  }
  return { title: "Aksi belum berhasil", body: message };
}

/** Ends free text with a period so it can be followed by another sentence. */
function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function buildSteps(
  req: StockRequest,
  isWarehouse: boolean,
  isKitchen: boolean,
): RouteStep[] {
  const stamp = (iso?: string | null): ReactNode =>
    iso ? <span className="ds-num">{formatStamp(iso)}</span> : null;
  const waiting = (mine: boolean, who: string): ReactNode =>
    mine ? <strong className="ds-rail-strong">menunggu Anda</strong> : `menunggu ${who}`;

  if (req.status === "rejected") {
    return [
      { key: "submitted", label: "Diajukan", state: "done", location: "kitchen", meta: stamp(req.created_at) },
      { key: "rejected", label: "Ditolak", state: "done", location: "warehouse", meta: stamp(req.rejected_at) },
    ];
  }

  const order = ["submitted", "approved", "transferred", "received"];
  const idx = Math.max(0, order.indexOf(req.status));
  const state = (step: number): RouteStep["state"] =>
    idx > step ? "done" : idx === step ? "current" : "todo";
  const lastDone = req.status === "received";

  return [
    {
      key: "submitted",
      label: "Diajukan",
      state: "done",
      location: "kitchen",
      meta: stamp(req.created_at),
    },
    {
      key: "approved",
      label: "Disetujui",
      state: state(0) === "current" ? "current" : "done",
      location: "warehouse",
      meta: idx === 0 ? waiting(isWarehouse, "gudang") : stamp(req.approved_at),
    },
    {
      key: "transferred",
      label: "Dikirim ke dapur",
      state: state(1),
      location: "warehouse",
      meta:
        idx === 1
          ? waiting(isWarehouse, "gudang")
          : idx > 1
            ? stamp(req.transferred_at)
            : "stok gudang berkurang",
    },
    {
      key: "received",
      label: "Diterima",
      state: lastDone ? "done" : state(2) === "current" ? "current" : "todo",
      location: "kitchen",
      meta: lastDone
        ? stamp(req.received_at)
        : idx === 2
          ? waiting(isKitchen, "dapur")
          : "stok dapur bertambah",
    },
  ];
}

function shortageTitle(short: LineCheck[]): string {
  const first = short[0];
  if (short.length === 1) {
    return `${first.line.item_name} kurang ${formatQty(first.shortBy, first.line.unit_code)} di gudang`;
  }
  return `${first.line.item_name} dan ${short.length - 1} bahan lain kurang di gudang`;
}

function StockRequestDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const focus = parseRequestFocus(searchParams.get("focus"));

  const [req, setReq] = useState<StockRequest | null>(null);
  const [stocks, setStocks] = useState<Map<string, number>>(() => new Map());
  const [mins, setMins] = useState<Map<string, number>>(() => new Map());
  // "loading" until the stock list answers: an empty map would make every line look short.
  const [stockState, setStockState] = useState<"loading" | "ready" | "error">("loading");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ActionKey | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [showKitchenUi, setShowKitchenUi] = useState(false);
  const [showWarehouseUi, setShowWarehouseUi] = useState(false);
<<<<<<< HEAD
  const [shortages, setShortages] = useState<ShortageDetail[] | null>(null);
  const [shortageTitle, setShortageTitle] = useState("");
  // mode: which inline form is open
  const [mode, setMode] = useState<"none" | "transfer" | "receive">("none");
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [whStock, setWhStock] = useState<Record<string, number>>({});
=======
  const reasonRef = useRef<HTMLTextAreaElement>(null);
>>>>>>> origin/feat/web-redesign

  const listHref = focus ? `/app/stock-requests?focus=${focus}` : "/app/stock-requests";

  const load = useCallback(async () => {
    setLoadError(null);
    setStockState("loading");
    try {
      setReq(await transferApi.get(id));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat dokumen");
      setReq(null);
      setLoading(false);
      return;
    }
    setLoading(false);
    try {
      const [stockRows, itemRows] = await Promise.all([
        warehouseApi.listStocks(),
        warehouseApi.listItems(),
      ]);
      setStocks(new Map(stockRows.map((s) => [s.item_id, s.qty])));
      setMins(new Map(itemRows.map((i) => [i.id, i.min_stock])));
      setStockState("ready");
    } catch {
      setStockState("error");
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

<<<<<<< HEAD
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
=======
  useEffect(() => {
    if (rejectOpen) reasonRef.current?.focus();
  }, [rejectOpen]);

  const checks = useMemo(
    () => checkLines(req?.lines ?? [], stocks, mins),
    [req?.lines, stocks, mins],
  );

  async function run(key: ActionKey, action: () => Promise<StockRequest>, okMsg: string) {
    setBusy(key);
    setActionError(null);
    try {
      const updated = await action();
      setReq((prev) => ({
        ...updated,
        packages: updated.packages ?? prev?.packages,
        lines: updated.lines ?? prev?.lines,
      }));
      setRejectOpen(false);
      setReason("");
>>>>>>> origin/feat/web-redesign
      toastSuccess(okMsg);
      return true;
    } catch (e) {
<<<<<<< HEAD
      const short = shortageDetails(e);
      if (short) {
        setShortages(short);
        setShortageTitle(e instanceof Error ? e.message : "Persediaan kurang");
      }
      toastError(e instanceof Error ? e.message : "Aksi gagal");
      return false;
=======
      setActionError(e instanceof Error ? e.message : "Aksi gagal");
>>>>>>> origin/feat/web-redesign
    } finally {
      setBusy(null);
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
      <div className="ds-screen">
        <p className="ds-card-hint">Memuat dokumen…</p>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="ds-screen">
        <InlineAlert
          role="alert"
          title="Dokumen permintaan tidak bisa dimuat"
          actions={
            <>
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Coba lagi
              </Button>
              <LinkButton size="sm" variant="secondary" href={listHref}>
                Kembali ke daftar
              </LinkButton>
            </>
          }
        >
          {loadError ?? "Permintaan tidak ditemukan"}. Bisa jadi dokumennya sudah dihapus atau
          tautannya keliru.
        </InlineAlert>
      </div>
    );
  }

  const packages = req.packages ?? [];
  const lines = req.lines ?? [];
  const isOpen = req.status === "submitted" || req.status === "approved";
  const stockReady = stockState === "ready";
  const showStockCols = isOpen && stockReady;
  const short = showStockCols ? shortages(checks) : [];
  const blockTransfer = req.status === "approved" && (short.length > 0 || !stockReady);
  const number = docNo("PRM", req.id);
  const canReject = showWarehouseUi && req.status === "submitted";

  const actionsNote: ReactNode =
    showWarehouseUi && req.status === "submitted"
      ? "Menyetujui belum mengubah stok."
      : showWarehouseUi && req.status === "approved"
        ? !stockReady
          ? stockState === "loading"
            ? "Memeriksa stok gudang sebelum bisa dikirim…"
            : "Belum bisa dikirim: stok gudang belum berhasil dimuat."
          : blockTransfer
            ? `Belum bisa dikirim: ${shortageTitle(short)}. Catat persediaan masuk dulu.`
            : "Mengirim mengurangi stok gudang."
        : showKitchenUi && req.status === "transferred"
          ? "Mengonfirmasi menambah stok dapur."
          : undefined;

  const actionInfo = actionError ? explainActionError(actionError) : null;
  const shortList =
    short.length > 1
      ? `Kurang: ${short.map((c) => `${c.line.item_name} ${formatQty(c.shortBy, c.line.unit_code)}`).join(", ")}. `
      : "";

  const trail: { time: string; text: ReactNode; pending?: boolean }[] = [
    {
      time: formatStamp(req.created_at),
      text: `Diajukan oleh Dapur dengan ${
        packages.length > 0 ? `${packages.length} paket menu` : "permintaan per item"
      } dan ${lines.length} baris bahan`,
    },
  ];
  if (req.approved_at) trail.push({ time: formatStamp(req.approved_at), text: "Disetujui gudang" });
  if (req.transferred_at) {
    trail.push({
      time: formatStamp(req.transferred_at),
      text: "Dikirim dari gudang, stok gudang berkurang",
    });
  }
  if (req.received_at) {
    trail.push({
      time: formatStamp(req.received_at),
      text: "Diterima dapur, stok dapur bertambah",
    });
  }
  if (req.rejected_at) {
    trail.push({
      time: formatStamp(req.rejected_at),
      text: (
        <>
          Ditolak gudang
          {req.reject_reason ? <> · Alasan: {req.reject_reason}</> : null}
        </>
      ),
    });
  }
  if (req.status === "submitted") trail.push({ time: "—", text: "Menunggu persetujuan gudang", pending: true });
  if (req.status === "approved") trail.push({ time: "—", text: "Menunggu pengiriman dari gudang", pending: true });
  if (req.status === "transferred") trail.push({ time: "—", text: "Menunggu konfirmasi terima dapur", pending: true });

  return (
<<<<<<< HEAD
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
=======
    <>
      <div className="ds-screen no-print">
        <PageHeader
          align="start"
          mono
          compactLede
          title={number}
          titleAside={<StatusChip kind="request" status={req.status} size="lg" />}
          lede={
            <>
              Diajukan <strong className="ds-medium">Dapur</strong> ·{" "}
              {formatDay(req.created_at)}{" "}
              <span className="ds-num">{formatClock(req.created_at)}</span>
            </>
          }
          actions={
            <>
              <Button variant="secondary" onClick={() => window.print()}>
                Cetak berita acara
              </Button>
              {canReject ? (
                <Button
                  variant="danger"
                  aria-expanded={rejectOpen}
                  aria-controls="reject-panel"
                  disabled={busy !== null}
                  onClick={() => setRejectOpen((open) => !open)}
                >
                  Tolak
                </Button>
              ) : null}
              {showWarehouseUi && req.status === "submitted" ? (
                <Button
                  disabled={busy !== null}
                  onClick={() =>
                    void run("approve", () => transferApi.approve(req.id), "Permintaan disetujui")
                  }
                >
                  {busy === "approve" ? BUSY_LABEL.approve : "Setujui permintaan"}
                </Button>
              ) : null}
              {showWarehouseUi && req.status === "approved" ? (
                <Button
                  disabled={busy !== null || blockTransfer}
                  aria-describedby="detail-note"
                  onClick={() =>
                    void run(
                      "transfer",
                      () => transferApi.transfer(req.id),
                      "Persediaan gudang dikurangi (transfer)",
                    )
                  }
                >
                  {busy === "transfer" ? BUSY_LABEL.transfer : "Kirim ke dapur"}
                </Button>
              ) : null}
              {showKitchenUi && req.status === "transferred" ? (
                <Button
                  disabled={busy !== null}
                  onClick={() =>
                    void run(
                      "receive",
                      () => transferApi.receive(req.id),
                      "Persediaan dapur bertambah (diterima)",
                    )
                  }
                >
                  {busy === "receive" ? BUSY_LABEL.receive : "Konfirmasi terima"}
                </Button>
              ) : null}
            </>
          }
          actionsNote={actionsNote ? <span id="detail-note">{actionsNote}</span> : undefined}
        />

        <RouteRail steps={buildSteps(req, showWarehouseUi, showKitchenUi)} />

        {actionInfo ? (
          <InlineAlert
            role="alert"
            title={actionInfo.title}
            actions={
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Muat ulang
              </Button>
            }
          >
            {actionInfo.body}
          </InlineAlert>
        ) : null}

        {req.status === "rejected" ? (
          <InlineAlert title="Permintaan ini ditolak gudang">
            {req.reject_reason
              ? `Alasan: ${sentence(req.reject_reason)}`
              : "Gudang tidak mencantumkan alasan."}{" "}
            Dokumen ini tidak akan diproses. Ajukan permintaan baru bila kebutuhannya masih ada.
          </InlineAlert>
        ) : null}

        {isOpen && stockState === "error" ? (
          <InlineAlert
            tone="warn"
            title="Perbandingan dengan stok gudang belum tersedia"
            actions={
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Muat ulang
              </Button>
            }
          >
            Stok gudang tidak berhasil dimuat, jadi kolom stok di bawah tidak bisa dipercaya.
            Jangan kirim sebelum perbandingannya muncul.
          </InlineAlert>
        ) : null}

        {short.length > 0 ? (
          <InlineAlert
            title={shortageTitle(short)}
            actions={
              showWarehouseUi ? (
                <LinkButton size="sm" variant="secondary" href="/app/warehouse/stock-ins">
                  Catat persediaan masuk
                </LinkButton>
              ) : undefined
            }
          >
            {shortList}
            {showWarehouseUi
              ? req.status === "submitted"
                ? "Anda tetap bisa menyetujui, tapi pengiriman akan ditolak sampai stoknya cukup. Catat persediaan masuk dulu, atau tolak dan minta dapur mengurangi paket."
                : "Pengiriman ke dapur ditahan sampai stoknya cukup. Catat persediaan masuk dulu."
              : "Gudang belum bisa mengirim semua bahan sampai stoknya cukup. Hubungi gudang bila kebutuhannya mendesak."}
          </InlineAlert>
        ) : null}

        {canReject && rejectOpen ? (
          <section
            id="reject-panel"
            className="ds-card ds-reject"
            aria-labelledby="reject-title"
          >
            <h2 id="reject-title" className="ds-card-title">
              Tolak permintaan ini
            </h2>
            <div className="ds-quick-reasons">
              {QUICK_REASONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="ds-quick-reason"
                  aria-pressed={reason === q}
                  onClick={() => {
                    setReason(q);
                    reasonRef.current?.focus();
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
            <label className="ds-field">
              <span>
                Alasan{" "}
                <span className="ds-field-hint">Wajib. Alasan ini akan dibaca dapur.</span>
              </span>
              <textarea
                ref={reasonRef}
                className="ds-textarea"
                rows={3}
                value={reason}
                aria-required="true"
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="ds-actions-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setRejectOpen(false);
                  setReason("");
                }}
              >
                Batal
              </Button>
              <Button
                variant="danger-solid"
                disabled={busy !== null || reason.trim() === ""}
                onClick={() =>
                  void run(
                    "reject",
                    () => transferApi.reject(req.id, reason.trim()),
                    "Permintaan ditolak",
                  )
                }
              >
                {busy === "reject" ? BUSY_LABEL.reject : "Tolak permintaan"}
              </Button>
            </div>
          </section>
        ) : null}

        <div className="ds-split">
          <section className="ds-card ds-split-main" aria-labelledby="lines-title">
            <div className="ds-card-head">
              <h2 id="lines-title" className="ds-card-title">
                Rincian bahan{" "}
                <span className="ds-card-title-sub">· {lines.length} baris, sudah digabung</span>
              </h2>
              <p className="ds-card-hint">
                {showStockCols
                  ? "Dibandingkan dengan stok gudang saat ini"
                  : isOpen && stockState === "loading"
                    ? "Memuat stok gudang…"
                    : "Isi dikunci saat permintaan diajukan"}
              </p>
            </div>
            <div className="ds-table-wrap">
              <table className="ds-table is-detail is-stack">
                <thead>
                  <tr>
                    <th>Bahan</th>
                    <th className="is-num">Diminta</th>
                    {showStockCols ? (
                      <>
                        <th className="is-num">Stok gudang</th>
                        <th className="is-num">Sisa setelah kirim</th>
                        <th>Keterangan</th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c) => (
                    <tr key={c.line.id} className={showStockCols && c.shortBy > 0 ? "is-short" : undefined}>
                      <td data-title>
                        <div className="ds-cell-stack">
                          <span className="ds-cell-name">{c.line.item_name}</span>
                          <span className="ds-cell-sub ds-num">
                            {c.line.item_sku}
                            {c.line.category_name ? ` · ${c.line.category_name}` : ""}
                          </span>
                        </div>
                      </td>
                      <td data-label="Diminta" className="is-num">
                        <Qty value={c.line.qty} unit={c.line.unit_code} />
                      </td>
                      {showStockCols ? (
                        <>
                          <td data-label="Stok gudang" className="is-num">
                            <Qty value={c.stock} className="ds-ink-2" />
                          </td>
                          <td data-label="Sisa setelah kirim" className="is-num">
                            {c.shortBy > 0 ? (
                              <Qty value={c.after} signed tone="danger" />
                            ) : c.belowMin ? (
                              <Qty value={c.after} tone="warn" />
                            ) : (
                              <Qty value={c.after} />
                            )}
                          </td>
                          <td data-label="Keterangan" data-block>
                            {c.shortBy > 0 ? (
                              <span className="ds-note-danger">
                                Kurang {formatQty(c.shortBy, c.line.unit_code)}
                              </span>
                            ) : c.belowMin && c.min !== null ? (
                              <span className="ds-note-warn">
                                Di bawah minimum ({formatQty(c.min, c.line.unit_code)})
                              </span>
                            ) : (
                              <span className="ds-cell-sub">—</span>
                            )}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="ds-split-side">
            <section className="ds-card ds-side-card" aria-labelledby="pkg-title">
              <h2 id="pkg-title" className="ds-side-title">
                Yang diminta dapur
              </h2>
              {packages.length > 0 ? (
                packages.map((p) => (
                  <div key={p.id} className="ds-side-row">
                    <span>{p.menu_name}</span>
                    <span className="ds-num ds-strong">{formatQty(p.qty_paket)} paket</span>
                  </div>
                ))
              ) : (
                <p className="ds-side-text">
                  Tanpa paket menu. Permintaan ini langsung per item, {lines.length} baris.
                </p>
              )}
            </section>

            <section className="ds-card ds-side-card" aria-labelledby="note-title">
              <h2 id="note-title" className="ds-side-title">
                Catatan dari dapur
              </h2>
              <p className="ds-side-text">{req.note || "Tanpa catatan."}</p>
            </section>

            <section className="ds-card ds-side-card" aria-labelledby="trail-title">
              <h2 id="trail-title" className="ds-side-title">
                Jejak dokumen
              </h2>
              <ol className="ds-trail">
                {trail.map((t, i) => (
                  <li key={i} className={t.pending ? "is-pending" : undefined}>
                    <span className="ds-num ds-trail-time">{t.time}</span>
                    <span>{t.text}</span>
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </div>
      </div>

      {/* Printable berita acara: kept as it was, only shown by window.print() */}
      <article className="si-doc print-only" id="request-print">
>>>>>>> origin/feat/web-redesign
        <header className="si-doc-kop">
          <p className="si-doc-brand">Dapoer Sari</p>
          <p className="si-doc-org">Sistem manajemen inventaris</p>
        </header>

        <h2 className="si-doc-title">Berita acara permintaan persediaan</h2>

        <dl className="si-doc-meta-grid">
          <div className="si-doc-meta-row">
            <dt>Nomor</dt>
            <dd>{number}</dd>
          </div>
          <div className="si-doc-meta-row">
            <dt>Status</dt>
            <dd>{requestStatusLabel(req.status)}</dd>
          </div>
          <div className="si-doc-meta-row">
            <dt>Diajukan</dt>
            <dd>{formatFullStamp(req.created_at)}</dd>
          </div>
          {req.approved_at ? (
            <div className="si-doc-meta-row">
              <dt>Disetujui</dt>
              <dd>{formatFullStamp(req.approved_at)}</dd>
            </div>
          ) : null}
          {req.transferred_at ? (
            <div className="si-doc-meta-row">
              <dt>Ditransfer</dt>
              <dd>{formatFullStamp(req.transferred_at)}</dd>
            </div>
          ) : null}
          {req.received_at ? (
            <div className="si-doc-meta-row">
              <dt>Diterima</dt>
              <dd>{formatFullStamp(req.received_at)}</dd>
            </div>
          ) : null}
          {req.rejected_at ? (
            <div className="si-doc-meta-row">
              <dt>Ditolak</dt>
              <dd>{formatFullStamp(req.rejected_at)}</dd>
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
          Pada tanggal {formatFullStamp(req.created_at)} dapur mengajukan permintaan persediaan
          kepada gudang dengan rincian paket dan item sebagaimana tercantum dalam berita acara
          ini.
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
          <strong>Ringkasan:</strong> {packages.length} paket menu · {lines.length} baris item
        </p>

        <h3 className="si-doc-section-title">Ringkasan paket</h3>
        {packages.length === 0 ? (
          <p className="si-doc-note muted">Tidak ada paket menu (permintaan by item).</p>
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
                    <td>{formatQty(p.qty_paket)}</td>
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
<<<<<<< HEAD
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
=======
                  <td>{formatQty(l.qty)}</td>
>>>>>>> origin/feat/web-redesign
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="si-doc-closing">
          {statusFootnote(req.status)} Demikian berita acara ini dibuat untuk dipergunakan
          sebagaimana mestinya.
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
    </>
  );
}

export default function StockRequestDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="ds-screen">
          <p className="ds-card-hint">Memuat…</p>
        </div>
      }
    >
      <StockRequestDetailContent />
    </Suspense>
  );
}
