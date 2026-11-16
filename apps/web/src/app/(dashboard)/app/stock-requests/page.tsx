"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { IconAlert, IconCheck } from "@/components/ui/Icons";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationTag } from "@/components/ui/LocationTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { Tabs } from "@/components/ui/Tabs";
import { getUser } from "@/lib/auth";
import { formatStamp, relativeTime } from "@/lib/datetime";
import { docNo, formatQty } from "@/lib/format";
import {
  parseRequestFocus,
  showKitchenRequestActions,
  showWarehouseRequestActions,
  type RequestFocus,
} from "@/lib/rbac";
<<<<<<< HEAD
import { toastError, toastSuccess } from "@/lib/toast";
import {
  requestStatusBadge,
  requestStatusLabel,
  StockRequest,
  transferApi,
} from "@/lib/transfer";
import { Item, warehouseApi } from "@/lib/warehouse";

const ALL_STATUSES = [
  "submitted",
  "approved",
  "transferred",
  "received",
  "rejected",
  "cancelled",
] as const;
=======
import { checkLines, shortages } from "@/lib/request-stock";
import { StockRequest, transferApi } from "@/lib/transfer";
import { warehouseApi } from "@/lib/warehouse";

type TabId = "aktif" | "setuju" | "kirim" | "jalan" | "selesai" | "tolak";
>>>>>>> origin/feat/web-redesign

const TABS: { id: TabId; label: string; statuses: string[]; hint: string; empty: string }[] = [
  {
    id: "aktif",
    label: "Aktif",
    statuses: ["submitted", "approved", "transferred"],
    hint: "Semua yang masih berjalan. Terlama di atas.",
    empty: "Tidak ada permintaan yang sedang berjalan.",
  },
  {
    id: "setuju",
    label: "Perlu disetujui",
    statuses: ["submitted"],
    hint: "Menunggu keputusan gudang. Terlama di atas.",
    empty: "Tidak ada permintaan yang menunggu persetujuan.",
  },
  {
    id: "kirim",
    label: "Siap dikirim",
    statuses: ["approved"],
    hint: "Sudah disetujui, belum dikirim ke dapur. Terlama di atas.",
    empty: "Tidak ada permintaan yang siap dikirim.",
  },
  {
    id: "jalan",
    label: "Dalam perjalanan",
    statuses: ["transferred"],
    hint: "Sudah dikirim gudang, menunggu dapur konfirmasi terima. Terlama di atas.",
    empty: "Tidak ada kiriman yang sedang dalam perjalanan.",
  },
  {
    id: "selesai",
    label: "Selesai",
    statuses: ["received"],
    hint: "Sudah diterima dapur. Terbaru di atas.",
    empty: "Belum ada permintaan yang selesai.",
  },
  {
    id: "tolak",
    label: "Ditolak",
    statuses: ["rejected"],
    hint: "Ditolak gudang. Terbaru di atas.",
    empty: "Tidak ada permintaan yang ditolak.",
  },
];

/** Past this many rows the list stops fetching per-request details (one call each). */
const DETAIL_CAP = 60;

const NO_MINS = new Map<string, number>();

function describeContent(
  detail: StockRequest | undefined,
): { main: string; sub: string } | null {
  if (!detail) return null;
  const packages = detail.packages ?? [];
  const lines = detail.lines ?? [];
  let main: string;
  if (packages.length > 0) {
    main = packages.map((p) => `${p.menu_name} × ${formatQty(p.qty_paket)}`).join(", ");
  } else if (lines.length > 0) {
    const names = lines.slice(0, 3).map((l) => l.item_name);
    const more = lines.length > 3 ? ` +${lines.length - 3}` : "";
    main = `Per item: ${names.join(", ")}${more}`;
  } else {
    main = "Tanpa isi";
  }
  let sub = `${lines.length} bahan${packages.length > 0 ? " setelah digabung" : ""}`;
  if (detail.status === "transferred" && detail.transferred_at) {
    sub += ` · dikirim ${formatStamp(detail.transferred_at)}`;
  }
  if (detail.status === "received" && detail.received_at) {
    sub += ` · diterima ${formatStamp(detail.received_at)}`;
  }
  return { main, sub };
}

function StockCell({
  request,
  detail,
  stocks,
}: {
  request: StockRequest;
  detail: StockRequest | undefined;
  stocks: Map<string, number>;
}): ReactNode {
  if (request.status === "transferred" || request.status === "received") {
    return <span className="ds-stock-muted">Sudah dikirim</span>;
  }
  if (request.status === "rejected") {
    return <span className="ds-stock-muted">—</span>;
  }
  if (!detail?.lines) return <span className="ds-stock-muted">—</span>;
  const short = shortages(checkLines(detail.lines, stocks, NO_MINS));
  if (short.length === 0) {
    return (
      <span className="ds-stock-ok">
        <IconCheck />
        Stok cukup
      </span>
    );
  }
  const first = short[0];
  const extra = short.length > 1 ? ` +${short.length - 1} lainnya` : "";
  return (
    <span className="ds-stock-short">
      <IconAlert />
      {first.line.item_name} kurang {formatQty(first.shortBy, first.line.unit_code)}
      {extra}
    </span>
  );
}

function rowAction(
  request: StockRequest,
  showWarehouse: boolean,
  showKitchen: boolean,
): { label: string; primary: boolean } {
  if (showWarehouse && request.status === "submitted") return { label: "Tinjau", primary: true };
  if (showWarehouse && request.status === "approved") {
    return { label: "Kirim ke dapur", primary: true };
  }
  if (showKitchen && request.status === "transferred") {
    return { label: "Konfirmasi terima", primary: true };
  }
  return { label: "Lihat", primary: false };
}

function titleFor(focus: RequestFocus | null): string {
  return focus === "warehouse" ? "Antrian permintaan" : "Permintaan persediaan";
}

function ledeFor(focus: RequestFocus | null): string {
  if (focus === "warehouse") {
    return "Permintaan dari dapur. Tinjau ketersediaan stok, setujui atau tolak, lalu kirim barangnya.";
  }
  if (focus === "kitchen") {
    return "Ajukan kebutuhan bahan ke gudang, lalu konfirmasi saat kiriman sampai di dapur.";
  }
  return "Pengajuan, persetujuan, pengiriman, dan penerimaan.";
}

function StockRequestsContent() {
  const searchParams = useSearchParams();
  const focus = parseRequestFocus(searchParams.get("focus"));

  const [rows, setRows] = useState<StockRequest[]>([]);
  const [details, setDetails] = useState<Record<string, StockRequest>>({});
  const [stocks, setStocks] = useState<Map<string, number>>(() => new Map());
  const [tab, setTab] = useState<TabId>("aktif");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showKitchenUi, setShowKitchenUi] = useState(false);
  const [showWarehouseUi, setShowWarehouseUi] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [reqs, stockRows] = await Promise.all([
        transferApi.list(),
        warehouseApi.listStocks(),
      ]);
      setRows(reqs);
      setStocks(new Map(stockRows.map((s) => [s.item_id, s.qty])));
      setLoading(false);

      // TODO(api): GET /stock-requests returns no packages or lines, so the "Isi permintaan"
      // and "Stok gudang" columns need one GET per request. Include packages, lines or a
      // shortage flag in the list response to drop this fan-out.
      const open = reqs.filter((r) => r.status === "submitted" || r.status === "approved");
      const rest = reqs.filter((r) => r.status !== "submitted" && r.status !== "approved");
      const ids = [...open, ...rest].slice(0, DETAIL_CAP).map((r) => r.id);
      setDetailsLoading(true);
      const settled = await Promise.allSettled(ids.map((id) => transferApi.get(id)));
      const next: Record<string, StockRequest> = {};
      for (const result of settled) {
        if (result.status === "fulfilled") next[result.value.id] = result.value;
      }
      setDetails(next);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat permintaan");
      setLoading(false);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    if (user) {
      setShowKitchenUi(showKitchenRequestActions(user.role, focus));
      setShowWarehouseUi(showWarehouseRequestActions(user.role, focus));
    }
    void load();
  }, [load, focus]);

  const counts = useMemo(() => {
    const out = {} as Record<TabId, number>;
    for (const t of TABS) {
      out[t.id] = rows.filter((r) => t.statuses.includes(r.status)).length;
    }
    return out;
  }, [rows]);

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];

  const visible = useMemo(() => {
    const allowed = new Set(activeTab.statuses);
    let list = rows.filter((r) => allowed.has(r.status));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const menus = (details[r.id]?.packages ?? []).map((p) => p.menu_name.toLowerCase());
        return (
          docNo("PRM", r.id).toLowerCase().includes(q) ||
          r.id.toLowerCase().startsWith(q) ||
          menus.some((m) => m.includes(q))
        );
      });
    }
    const oldestFirst = activeTab.id !== "selesai" && activeTab.id !== "tolak";
    return [...list].sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return oldestFirst ? diff : -diff;
    });
  }, [rows, details, query, activeTab]);

  function detailHref(id: string): string {
    return focus ? `/app/stock-requests/${id}?focus=${focus}` : `/app/stock-requests/${id}`;
  }

  const kicker = focus ? (
    <LocationTag
      location={focus}
      label={focus === "warehouse" ? "Pintu gudang" : "Pintu dapur"}
    />
  ) : undefined;

  return (
    <div className="ds-screen">
      <PageHeader
        kicker={kicker}
        title={titleFor(focus)}
        lede={ledeFor(focus)}
        actions={
          showKitchenUi ? (
            <LinkButton href="/app/stock-requests/new?focus=kitchen">
              Ajukan permintaan
            </LinkButton>
          ) : undefined
        }
      />

      <Tabs
        label="Filter status"
        idPrefix="sr"
        value={tab}
        onChange={(id) => setTab(id as TabId)}
        items={TABS.map((t) => ({ id: t.id, label: t.label, count: counts[t.id] }))}
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Daftar permintaan belum bisa dimuat"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Coba lagi
            </Button>
          }
        >
          {loadError}. Periksa koneksi Anda, lalu coba lagi.
        </InlineAlert>
      ) : null}

      <section
        className="ds-card ds-card-clip"
        id="sr-panel"
        role="tabpanel"
        aria-labelledby={`sr-tab-${tab}`}
      >
        <div className="ds-toolbar">
          <p className="ds-card-hint">{activeTab.hint}</p>
          <label className="ds-search">
            Cari
            <input
              type="search"
              placeholder="No. dokumen atau menu"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <div className="ds-empty">
            <p className="ds-empty-text">Memuat permintaan…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">
              {query.trim() ? "Tidak ada yang cocok" : "Kosong"}
            </p>
            <p className="ds-empty-text">
              {query.trim()
                ? "Coba nomor dokumen atau nama menu yang lain."
                : activeTab.empty}
            </p>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table is-stack">
              <thead>
                <tr>
                  <th>Dokumen</th>
                  <th>Diajukan</th>
                  <th>Isi permintaan</th>
                  <th>Stok gudang</th>
                  <th>Status</th>
                  <th>
                    <span className="ds-sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
<<<<<<< HEAD
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td>
                      <span className={requestStatusBadge(r.status)}>
                        {requestStatusLabel(r.status)}
                      </span>
                    </td>
                    <td>{r.note || "—"}</td>
                    <td>
                      <Link className="btn btn-ghost" href={detailHref(r.id)}>
                        Buka
                      </Link>
                    </td>
                  </tr>
                ))}
=======
                {visible.map((r) => {
                  const detail = details[r.id];
                  const content = describeContent(detail);
                  const action = rowAction(r, showWarehouseUi, showKitchenUi);
                  return (
                    <tr key={r.id}>
                      <td data-title>
                        <div className="ds-cell-stack">
                          <Link className="ds-doc-link ds-num" href={detailHref(r.id)}>
                            {docNo("PRM", r.id)}
                          </Link>
                          <span className="ds-cell-sub">oleh Dapur</span>
                        </div>
                      </td>
                      <td data-label="Diajukan" className="ds-nowrap">
                        <div className="ds-cell-stack">
                          <span className="ds-cell-main">{relativeTime(r.created_at)}</span>
                          <span className="ds-cell-sub ds-num">{formatStamp(r.created_at)}</span>
                        </div>
                      </td>
                      <td data-label="Isi permintaan" data-block>
                        <div className="ds-cell-stack ds-cell-wide">
                          {content ? (
                            <>
                              <span className="ds-cell-main">{content.main}</span>
                              <span className="ds-cell-sub">{content.sub}</span>
                            </>
                          ) : (
                            <span className="ds-cell-sub">
                              {detailsLoading ? "Memuat isi…" : "Buka dokumen untuk melihat isi"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td data-label="Stok gudang" className="ds-nowrap">
                        <StockCell request={r} detail={detail} stocks={stocks} />
                      </td>
                      <td data-label="Status" className="ds-nowrap">
                        <StatusChip kind="request" status={r.status} />
                      </td>
                      <td data-action className="ds-cell-right">
                        <LinkButton
                          href={detailHref(r.id)}
                          size="sm"
                          variant={action.primary ? "primary" : "secondary"}
                        >
                          {action.label}
                        </LinkButton>
                      </td>
                    </tr>
                  );
                })}
>>>>>>> origin/feat/web-redesign
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!showKitchenUi && !showWarehouseUi ? (
        <p className="ds-card-hint">
          Anda hanya dapat melihat daftar permintaan. Buka dari menu Gudang atau Dapur untuk
          mengambil tindakan.
        </p>
      ) : null}
    </div>
  );
}

export default function StockRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="ds-screen">
          <p className="ds-card-hint">Memuat…</p>
        </div>
      }
    >
      <StockRequestsContent />
    </Suspense>
  );
}
