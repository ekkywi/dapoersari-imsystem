"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationTag, type Location } from "@/components/ui/LocationTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { getUser } from "@/lib/auth";
import { dashboardApi, type DashboardSummary, type LowStockAlert } from "@/lib/dashboard";
import {
  formatClock,
  formatDateLong,
  formatDateOnly,
  formatRecent,
  relativeTime,
  startOfToday,
  todayISO,
} from "@/lib/datetime";
import { docNo, formatQty, signedQty } from "@/lib/format";
import { historyApi, stockReasonLabel, type StockHistoryEntry } from "@/lib/history";
import { kitchenApi, type MenuClosing } from "@/lib/kitchen";
import { type Opname, opnameApi } from "@/lib/opname";
import {
  canAccessStockRequests,
  canMutateKitchen,
  canMutateWarehouse,
  navKeysForRole,
} from "@/lib/rbac";
import { checkLines, shortages } from "@/lib/request-stock";
import { type StockRequest, transferApi } from "@/lib/transfer";
import { warehouseApi } from "@/lib/warehouse";

type ActionRow = {
  key: string;
  location: Location;
  /** When the thing started waiting; rows sort oldest first. */
  since: number;
  title: string;
  sub: ReactNode;
  href: string;
  cta: string;
};

/** Beyond this many submitted requests the shortage check stops fetching details (one GET each). */
const SHORTAGE_CAP = 10;
const NO_MINS = new Map<string, number>();

const ts = (iso?: string | null): number => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY);
const byAge = (at: (r: StockRequest) => string | null | undefined) => (a: StockRequest, b: StockRequest) =>
  ts(at(a)) - ts(at(b));

function Mono({ children }: { children: ReactNode }) {
  return <span className="ds-num">{children}</span>;
}

/** The kitchen and warehouse call these differently; Ringkasan uses the operators' words. */
function reasonText(reason: string): string {
  switch (reason) {
    case "transfer_out":
      return "Transfer ke dapur";
    case "transfer_in":
      return "Diterima dari gudang";
    case "menu_closing":
      return "Akhir shift";
    default:
      return stockReasonLabel(reason);
  }
}

/** Items closest to their minimum first: critical before low, then effective ÷ min. */
function thinnest(alerts: LowStockAlert[]): LowStockAlert[] {
  const rank = (a: LowStockAlert) => (a.level === "critical" ? 0 : 1);
  const ratio = (a: LowStockAlert) => (a.min_stock > 0 ? a.effective_qty / a.min_stock : 0);
  return [...alerts].sort((a, b) => rank(a) - rank(b) || ratio(a) - ratio(b)).slice(0, 5);
}

function Tile({
  href,
  label,
  value,
  sub,
  danger = false,
}: {
  href?: string;
  label: string;
  value: number;
  sub: string;
  danger?: boolean;
}) {
  const inner = (
    <>
      <span className="ds-tile-label">{label}</span>
      <span className="ds-num ds-tile-value">{formatQty(value)}</span>
      <span className={`ds-tile-sub${danger ? " is-danger" : ""}`}>{sub}</span>
    </>
  );
  return href ? (
    <Link href={href} className="ds-tile">
      {inner}
    </Link>
  ) : (
    <div className="ds-tile">{inner}</div>
  );
}

export default function DashboardPage() {
  const [role, setRole] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<LowStockAlert[] | null>(null);
  const [alertsError, setAlertsError] = useState(false);
  const [history, setHistory] = useState<StockHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [details, setDetails] = useState<Record<string, StockRequest>>({});
  const [whStock, setWhStock] = useState<Map<string, number>>(() => new Map());
  const [closings, setClosings] = useState<MenuClosing[]>([]);
  const [opnames, setOpnames] = useState<Opname[]>([]);
  // Which action sources failed. A row is only shown when its own source loaded: "no closing today"
  // derived from a failed fetch would be a false reminder.
  const [failed, setFailed] = useState({ requests: false, stocks: false, closings: false, opnames: false });
  const actionsError = Object.values(failed).some(Boolean);
  const [actionsLoading, setActionsLoading] = useState(true);

  const load = useCallback(async (r: string) => {
    const wh = canMutateWarehouse(r);
    const kit = canMutateKitchen(r);
    setSummaryError(null);
    setAlertsError(false);
    setHistoryError(false);
    setFailed({ requests: false, stocks: false, closings: false, opnames: false });

    const top = Promise.allSettled([
      dashboardApi.summary(),
      dashboardApi.lowStock(),
      historyApi.listStock({ limit: 5 }),
    ]).then(([sum, low, hist]) => {
      if (sum.status === "fulfilled") setSummary(sum.value);
      else setSummaryError(sum.reason instanceof Error ? sum.reason.message : "Gagal memuat ringkasan");
      if (low.status === "fulfilled") setAlerts(low.value);
      else setAlertsError(true);
      if (hist.status === "fulfilled") setHistory(hist.value);
      else setHistoryError(true);
    });

    if (!wh && !kit) {
      await top;
      setActionsLoading(false);
      return;
    }

    // Only fetch what this role can act on.
    const [reqs, stocks, closs, opns] = await Promise.allSettled([
      transferApi.list(),
      wh ? warehouseApi.listStocks() : Promise.resolve([]),
      kit ? kitchenApi.listClosings() : Promise.resolve([]),
      opnameApi.list(),
    ]);
    setFailed({
      requests: reqs.status === "rejected",
      stocks: stocks.status === "rejected",
      closings: closs.status === "rejected",
      opnames: opns.status === "rejected",
    });
    const reqList = reqs.status === "fulfilled" ? reqs.value : [];
    setRequests(reqList);
    if (stocks.status === "fulfilled") setWhStock(new Map(stocks.value.map((s) => [s.item_id, s.qty])));
    if (closs.status === "fulfilled") setClosings(closs.value);
    if (opns.status === "fulfilled") setOpnames(opns.value);

    if (wh) {
      // TODO(api): GET /stock-requests has no lines, so the shortage check and the "siap dikirim"
      // subtitle need one GET per request (capped).
      const submitted = reqList.filter((x) => x.status === "submitted").sort(byAge((x) => x.created_at));
      const approved = reqList.filter((x) => x.status === "approved").sort(byAge((x) => x.approved_at ?? x.created_at));
      const ids = [...submitted.slice(0, SHORTAGE_CAP), ...approved.slice(0, 1)].map((x) => x.id);
      const settled = await Promise.allSettled(ids.map((id) => transferApi.get(id)));
      const next: Record<string, StockRequest> = {};
      for (const s of settled) if (s.status === "fulfilled") next[s.value.id] = s.value;
      setDetails(next);
    }
    await top;
    setActionsLoading(false);
  }, []);

  useEffect(() => {
    const r = getUser()?.role ?? "";
    setRole(r);
    void load(r);
  }, [load]);

  const wh = role !== null && canMutateWarehouse(role);
  const kit = role !== null && canMutateKitchen(role);

  const rows = useMemo(() => {
    const out: ActionRow[] = [];
    const now = new Date();

    if (wh && !failed.requests) {
      const submitted = requests.filter((x) => x.status === "submitted").sort(byAge((x) => x.created_at));
      if (submitted.length > 0) {
        const first = submitted[0];
        out.push({
          key: "submitted",
          location: "warehouse",
          since: ts(first.created_at),
          title: `${submitted.length} permintaan menunggu persetujuan`,
          sub: (
            <>
              Terlama <Mono>{docNo("PRM", first.id)}</Mono>, diajukan{" "}
              {relativeTime(first.created_at, now)}
            </>
          ),
          href: "/app/stock-requests?focus=warehouse",
          cta: "Tinjau antrian",
        });
      }

      const short = (failed.stocks ? [] : submitted)
        .slice(0, SHORTAGE_CAP)
        .map((req) => ({ req, lines: shortages(checkLines(details[req.id]?.lines ?? [], whStock, NO_MINS)) }))
        .filter((x) => x.lines.length > 0);
      if (short.length > 0) {
        const { req, lines } = short[0];
        const worst = lines[0];
        out.push({
          key: "shortage",
          location: "warehouse",
          since: ts(req.created_at),
          title:
            short.length === 1
              ? "Satu permintaan butuh stok yang belum ada"
              : `${short.length} permintaan butuh stok yang belum ada`,
          sub: (
            <>
              {worst.line.item_name} pada <Mono>{docNo("PRM", req.id)}</Mono> kurang{" "}
              <Mono>{formatQty(worst.shortBy, worst.line.unit_code)}</Mono>
            </>
          ),
          href: `/app/stock-requests/${req.id}?focus=warehouse`,
          cta: "Lihat permintaan",
        });
      }

      const approved = requests
        .filter((x) => x.status === "approved")
        .sort(byAge((x) => x.approved_at ?? x.created_at));
      if (approved.length > 0) {
        const first = approved[0];
        const pk = details[first.id]?.packages ?? [];
        out.push({
          key: "approved",
          location: "warehouse",
          since: ts(first.approved_at ?? first.created_at),
          title: `${approved.length} permintaan siap dikirim ke dapur`,
          sub: (
            <>
              <Mono>{docNo("PRM", first.id)}</Mono>
              {pk.length > 0
                ? ` · ${pk.map((p) => `${p.menu_name} × ${formatQty(p.qty_paket)}`).join(", ")} paket`
                : ""}
            </>
          ),
          href:
            approved.length === 1
              ? `/app/stock-requests/${first.id}?focus=warehouse`
              : "/app/stock-requests?focus=warehouse",
          cta: "Proses transfer",
        });
      }
    }

    if (kit && !failed.requests) {
      const sent = requests
        .filter((x) => x.status === "transferred")
        .sort(byAge((x) => x.transferred_at ?? x.created_at));
      if (sent.length > 0) {
        const first = sent[0];
        out.push({
          key: "transferred",
          location: "kitchen",
          since: ts(first.transferred_at ?? first.created_at),
          title:
            sent.length === 1
              ? "Kiriman sudah sampai? Konfirmasi terima"
              : `${sent.length} kiriman menunggu konfirmasi terima`,
          sub: (
            <>
              <Mono>{docNo("PRM", first.id)}</Mono> dikirim gudang pukul{" "}
              <Mono>{first.transferred_at ? formatClock(first.transferred_at) : "—"}</Mono>
            </>
          ),
          href:
            sent.length === 1
              ? `/app/stock-requests/${first.id}?focus=kitchen`
              : "/app/stock-requests?focus=kitchen",
          cta: "Konfirmasi terima",
        });
      }

    }

    if (kit && !failed.closings) {
      const today = todayISO(now);
      if (!closings.some((c) => c.closing_date === today)) {
        const last = [...closings].sort((a, b) => b.closing_date.localeCompare(a.closing_date))[0];
        out.push({
          key: "closing",
          location: "kitchen",
          since: startOfToday(now),
          title: "Akhir shift hari ini belum dicatat",
          sub: `${
            last ? `Catatan terakhir ${formatDateOnly(last.closing_date)}` : "Belum ada akhir shift yang dicatat"
          } · stok dapur belum dikurangi pemakaian hari ini`,
          href: "/app/kitchen/closings",
          cta: "Tutup shift",
        });
      }
    }

    for (const loc of ["warehouse", "kitchen"] as const) {
      if (loc === "warehouse" ? !wh : !kit) continue;
      if (failed.opnames) continue;
      const drafts = opnames
        .filter((o) => o.status === "draft" && o.location === loc)
        .sort((a, b) => ts(a.created_at) - ts(b.created_at));
      if (drafts.length === 0) continue;
      const first = drafts[0];
      out.push({
        key: `opname-${loc}`,
        location: loc,
        since: ts(first.created_at),
        title:
          drafts.length === 1
            ? "Opname draf belum dikonfirmasi"
            : `${drafts.length} opname draf belum dikonfirmasi`,
        sub: (
          <>
            <Mono>{docNo("OPN", first.id)}</Mono> dibuat {relativeTime(first.created_at, now)} · stok belum
            berubah
          </>
        ),
        href: drafts.length === 1 ? `/app/opnames/${first.id}?focus=${loc}` : `/app/opnames?focus=${loc}`,
        cta: "Tinjau opname",
      });
    }

    return out.sort((a, b) => a.since - b.since);
  }, [wh, kit, failed, requests, details, whStock, closings, opnames]);

  const keys = role ? navKeysForRole(role) : null;
  const queueFocus = wh ? "warehouse" : "kitchen";
  const critical = (alerts ?? []).filter((a) => a.location === "warehouse" && a.level === "critical").length;
  const tipis = alerts ? thinnest(alerts) : [];

  return (
    <div className="ds-screen">
      <PageHeader
        kicker={formatDateLong()}
        title="Ringkasan"
        lede={
          actionsLoading ? (
            "Memeriksa apa yang menunggu Anda…"
          ) : rows.length > 0 ? (
            <>
              Ada <strong>{rows.length} hal</strong> yang menunggu Anda hari ini.
            </>
          ) : (
            "Tidak ada yang menunggu Anda hari ini."
          )
        }
        actions={
          <>
            {kit ? (
              <LinkButton variant="secondary" href="/app/stock-requests/new?focus=kitchen">
                Ajukan permintaan
              </LinkButton>
            ) : null}
            {wh ? <LinkButton href="/app/warehouse/stock-ins">Catat persediaan masuk</LinkButton> : null}
          </>
        }
      />

      {summaryError ? (
        <InlineAlert
          role="alert"
          title="Ringkasan belum bisa dimuat"
          actions={
            <Button size="sm" variant="secondary" onClick={() => role !== null && void load(role)}>
              Coba lagi
            </Button>
          }
        >
          {summaryError}. Periksa koneksi Anda, lalu coba lagi.
        </InlineAlert>
      ) : null}

      {actionsError ? (
        <InlineAlert
          tone="warn"
          title="Sebagian daftar tindakan belum bisa dimuat"
          actions={
            <Button size="sm" variant="secondary" onClick={() => role !== null && void load(role)}>
              Muat ulang
            </Button>
          }
        >
          Daftar di bawah mungkin kurang lengkap. Buka menu masing-masing untuk memastikan.
        </InlineAlert>
      ) : null}

      {wh || kit ? (
        <section className="ds-card ds-card-clip" aria-labelledby="todo-title">
          <div className="ds-todo-head">
            <h2 id="todo-title" className="ds-card-title">
              Perlu tindakan
            </h2>
            <p className="ds-card-hint">Diurutkan dari yang paling lama menunggu</p>
          </div>
          {actionsLoading ? (
            <p className="ds-todo-empty">Memuat…</p>
          ) : rows.length === 0 ? (
            <p className="ds-todo-empty">Semua beres untuk saat ini.</p>
          ) : (
            <ul className="ds-todo-list">
              {rows.map((row, i) => (
                <li key={row.key} className="ds-todo-row">
                  <span className="ds-todo-loc">
                    <LocationTag location={row.location} />
                  </span>
                  <div className="ds-todo-text">
                    <span className="ds-todo-title">{row.title}</span>
                    <span className="ds-todo-sub">{row.sub}</span>
                  </div>
                  <LinkButton href={row.href} variant={i === 0 ? "primary" : "secondary"}>
                    {row.cta}
                  </LinkButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {summary ? (
        <section className="ds-tiles" aria-label="Kondisi persediaan">
          <Tile
            href={keys?.has("stocks") ? "/app/warehouse/stocks" : undefined}
            label="Gudang di bawah minimum"
            value={summary.warehouse_low_stock}
            sub={critical > 0 ? `${critical} kritis` : "tidak ada yang kritis"}
            danger={critical > 0}
          />
          <Tile
            href={keys?.has("kitchen-stocks") ? "/app/kitchen/stocks" : undefined}
            label="Dapur di bawah minimum"
            value={summary.kitchen_low_stock}
            sub="sudah termasuk kiriman di jalan"
          />
          <Tile
            href={role && canAccessStockRequests(role) ? `/app/stock-requests?focus=${queueFocus}` : undefined}
            label="Permintaan aktif"
            value={summary.pending_approvals + summary.awaiting_transfer + summary.in_transit_requests}
            sub={`${summary.pending_approvals} diajukan · ${summary.awaiting_transfer} disetujui · ${summary.in_transit_requests} dikirim`}
          />
          <Tile
            href={keys?.has("items") ? "/app/warehouse/items" : keys?.has("menus") ? "/app/kitchen/menus" : undefined}
            label="Katalog aktif"
            value={summary.active_items}
            sub={`item · ${summary.active_menus} menu aktif`}
          />
        </section>
      ) : null}

      <div className="ds-two">
        <section className="ds-card" aria-labelledby="low-title">
          <div className="ds-todo-head">
            <h2 id="low-title" className="ds-card-title">
              Stok paling tipis
            </h2>
            <Link className="ds-link" href="/app/alerts">
              Semua peringatan
            </Link>
          </div>
          {alertsError ? (
            <p className="ds-todo-empty">Daftar stok tipis belum bisa dimuat.</p>
          ) : alerts === null ? (
            <p className="ds-todo-empty">Memuat…</p>
          ) : tipis.length === 0 ? (
            <p className="ds-todo-empty">Semua item di atas batas minimum.</p>
          ) : (
            <ul className="ds-mini-list">
              {tipis.map((a) => {
                const pct = a.min_stock > 0 ? Math.min(100, Math.max(3, (a.effective_qty / a.min_stock) * 100)) : 3;
                const critical = a.level === "critical";
                return (
                  <li key={`${a.location}-${a.item_id}`} className="ds-mini-row is-low">
                    <div className="ds-mini-main">
                      <span className="ds-mini-name">{a.name}</span>
                      <span className="ds-mini-sub">
                        <LocationTag location={a.location === "kitchen" ? "kitchen" : "warehouse"} size="sm" />
                        <span aria-hidden="true">·</span>
                        <span className={`ds-level-word ${critical ? "is-critical" : "is-low"}`}>
                          {critical ? "Kritis" : "Menipis"}
                        </span>
                      </span>
                    </div>
                    <div className={`ds-minibar${critical ? " is-critical" : ""}`} aria-hidden="true">
                      <div className="ds-minibar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="ds-num ds-mini-num">
                      {formatQty(a.effective_qty)} / {formatQty(a.min_stock, a.unit_code)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="ds-card" aria-labelledby="log-title">
          <div className="ds-todo-head">
            <h2 id="log-title" className="ds-card-title">
              Mutasi terakhir
            </h2>
            <Link className="ds-link" href="/app/history">
              Buka riwayat
            </Link>
          </div>
          {historyError ? (
            <p className="ds-todo-empty">Riwayat mutasi belum bisa dimuat.</p>
          ) : history === null ? (
            <p className="ds-todo-empty">Memuat…</p>
          ) : history.length === 0 ? (
            <p className="ds-todo-empty">Belum ada mutasi persediaan.</p>
          ) : (
            <ul className="ds-mini-list">
              {history.slice(0, 5).map((h) => (
                <li key={h.id} className="ds-mini-row is-log">
                  <span className="ds-num ds-mini-time">{formatRecent(h.created_at)}</span>
                  <div className="ds-mini-main">
                    <span className="ds-mini-name">{h.item_name}</span>
                    <span className="ds-mini-sub">
                      {h.location === "kitchen" ? "Dapur" : "Gudang"} · {reasonText(h.reason)}
                    </span>
                  </div>
                  <span className={`ds-num ds-delta${h.delta > 0 ? " is-plus" : ""}`}>
                    {signedQty(h.delta, h.unit_code)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
