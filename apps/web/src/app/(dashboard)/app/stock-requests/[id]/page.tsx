"use client";

import { useParams, useSearchParams } from "next/navigation";
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
import { getUser } from "@/lib/auth";
import { formatClock, formatDay, formatFullStamp, formatStamp } from "@/lib/datetime";
import { docNo, formatQty } from "@/lib/format";
import {
  parseRequestFocus,
  showKitchenRequestActions,
  showWarehouseRequestActions,
} from "@/lib/rbac";
import { checkLines, shortages, type LineCheck } from "@/lib/request-stock";
import { toastSuccess } from "@/lib/toast";
import { requestStatusLabel, StockRequest, transferApi } from "@/lib/transfer";
import { warehouseApi } from "@/lib/warehouse";

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
  const reasonRef = useRef<HTMLTextAreaElement>(null);

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
      toastSuccess(okMsg);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Aksi gagal");
    } finally {
      setBusy(null);
    }
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
              <table className="ds-table is-detail">
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
                      <td>
                        <div className="ds-cell-stack">
                          <span className="ds-cell-name">{c.line.item_name}</span>
                          <span className="ds-cell-sub ds-num">
                            {c.line.item_sku}
                            {c.line.category_name ? ` · ${c.line.category_name}` : ""}
                          </span>
                        </div>
                      </td>
                      <td className="is-num">
                        <Qty value={c.line.qty} unit={c.line.unit_code} />
                      </td>
                      {showStockCols ? (
                        <>
                          <td className="is-num">
                            <Qty value={c.stock} className="ds-ink-2" />
                          </td>
                          <td className="is-num">
                            {c.shortBy > 0 ? (
                              <Qty value={c.after} signed tone="danger" />
                            ) : c.belowMin ? (
                              <Qty value={c.after} tone="warn" />
                            ) : (
                              <Qty value={c.after} />
                            )}
                          </td>
                          <td>
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
                  <td>{formatQty(l.qty)}</td>
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
