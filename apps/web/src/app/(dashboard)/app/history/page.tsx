"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationTag } from "@/components/ui/LocationTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { Qty } from "@/components/ui/Qty";
import { FilterChips, Tabs } from "@/components/ui/Tabs";
import { formatFullStamp } from "@/lib/datetime";
import {
  activityActionLabel,
  activityDetailLabel,
  activityEntityLabel,
  type ActivityEntry,
  historyApi,
  type StockHistoryEntry,
  stockReasonLabel,
} from "@/lib/history";
import { warehouseApi } from "@/lib/warehouse";

type Tab = "stock" | "activity";
type LocationFilter = "" | "warehouse" | "kitchen";

/** The API returns the newest `limit` rows; there is no paging yet. */
const LIMIT = 100;

function refHref(
  refType?: string | null,
  refId?: string | null,
  location?: string,
): string | null {
  if (!refType || !refId) return null;
  if (refType === "opname") {
    const focus =
      location === "kitchen" || location === "warehouse" ? `?focus=${location}` : "";
    return `/app/opnames/${refId}${focus}`;
  }
  if (refType === "menu_closing") return `/app/kitchen/closings`;
  if (refType === "stock_request") return `/app/stock-requests/${refId}`;
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

function HistoryContent() {
  const searchParams = useSearchParams();
  // Linked from Persediaan and Peringatan: /app/history?item_id=…&location=…
  const itemId = searchParams.get("item_id") ?? "";
  const locationParam = searchParams.get("location");

  const [tab, setTab] = useState<Tab>("stock");
  const [location, setLocation] = useState<LocationFilter>(
    locationParam === "warehouse" || locationParam === "kitchen" ? locationParam : "",
  );
  const [query, setQuery] = useState("");
  const [stockRows, setStockRows] = useState<StockHistoryEntry[]>([]);
  const [activityRows, setActivityRows] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [itemInfo, setItemInfo] = useState<{ id: string; label: string } | null>(null);

  // A slow response for a tab or filter the user already left must not overwrite the current one.
  const request = useRef(0);

  const load = useCallback(async () => {
    const mine = ++request.current;
    setLoading(true);
    setLoadError(null);
    try {
      if (tab === "stock") {
        const rows = await historyApi.listStock({
          location: location || undefined,
          item_id: itemId || undefined,
          limit: LIMIT,
        });
        if (mine === request.current) setStockRows(rows);
      } else {
        const rows = await historyApi.listActivity(LIMIT);
        if (mine === request.current) setActivityRows(rows);
      }
    } catch (e) {
      if (mine === request.current) {
        setLoadError(e instanceof Error ? e.message : "Gagal memuat riwayat");
      }
    } finally {
      if (mine === request.current) setLoading(false);
    }
  }, [tab, location, itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The item's name comes from the item list, not from the first movement: an item that has
  // never moved has no rows, but the page should still say which item it is showing.
  useEffect(() => {
    if (!itemId) return;
    let alive = true;
    warehouseApi
      .listItems()
      .then((items) => {
        const it = items.find((x) => x.id === itemId);
        if (alive && it) setItemInfo({ id: itemId, label: `${it.sku} — ${it.name}` });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [itemId]);

  const itemLabel =
    itemInfo?.id === itemId
      ? itemInfo.label
      : stockRows[0] && stockRows[0].item_id === itemId
        ? `${stockRows[0].item_sku} — ${stockRows[0].item_name}`
        : null;

  const stockVisible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stockRows;
    return stockRows.filter(
      (r) =>
        r.item_name.toLowerCase().includes(q) ||
        r.item_sku.toLowerCase().includes(q) ||
        stockReasonLabel(r.reason).toLowerCase().includes(q),
    );
  }, [stockRows, query]);

  const activityVisible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activityRows;
    return activityRows.filter(
      (r) =>
        activityActionLabel(r.action).toLowerCase().includes(q) ||
        activityEntityLabel(r.entity_type, r.entity_id).toLowerCase().includes(q) ||
        activityDetailLabel(r.detail).toLowerCase().includes(q),
    );
  }, [activityRows, query]);

  const rows = tab === "stock" ? stockRows : activityRows;
  const visibleCount = tab === "stock" ? stockVisible.length : activityVisible.length;

  return (
    <div className="ds-screen">
      <PageHeader
        title="Riwayat"
        lede="Setiap perubahan stok dan catatan aktivitas, dari yang terbaru."
      />

      <Tabs
        label="Jenis riwayat"
        idPrefix="history"
        value={tab}
        onChange={(id) => {
          setTab(id as Tab);
          setQuery("");
        }}
        items={[
          { id: "stock", label: "Mutasi persediaan" },
          { id: "activity", label: "Aktivitas" },
        ]}
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Riwayat belum bisa dimuat"
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
        id="history-panel"
        role="tabpanel"
        aria-labelledby={`history-tab-${tab}`}
        className="ds-card ds-card-clip"
      >
        {itemId && tab === "stock" ? (
          <p className="ds-strip ds-strip-item">
            Menampilkan mutasi satu item
            {itemLabel ? (
              <>
                : <strong>{itemLabel}</strong>
              </>
            ) : null}
            . <Link href="/app/history">Tampilkan semua</Link>
          </p>
        ) : null}

        <div className="ds-toolbar">
          {tab === "stock" ? (
            <FilterChips
              label="Filter lokasi"
              value={location}
              onChange={(v) => setLocation(v as LocationFilter)}
              items={[
                { id: "", label: "Semua lokasi" },
                { id: "warehouse", label: "Gudang" },
                { id: "kitchen", label: "Dapur" },
              ]}
            />
          ) : (
            <p className="ds-card-hint">Log ini mencatat akhir shift dan opname. Perubahan stok lain ada di tab Mutasi persediaan.</p>
          )}
          <div className="ds-toolbar-group">
            <label className="ds-search">
              <span className="ds-sr-only">Cari riwayat</span>
              <input
                type="search"
                placeholder={tab === "stock" ? "Cari item, SKU, alasan" : "Cari aksi, dokumen"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Muat ulang
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="ds-empty">
            <p className="ds-empty-text">Memuat riwayat…</p>
          </div>
        ) : loadError && rows.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">Riwayat belum tersedia</p>
            <p className="ds-empty-text">Gunakan “Coba lagi” di atas setelah koneksi pulih.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">
              {tab === "stock" ? "Belum ada mutasi" : "Belum ada aktivitas"}
            </p>
            <p className="ds-empty-text">
              {tab === "stock"
                ? itemId || location
                  ? "Belum ada perubahan stok untuk filter ini."
                  : "Perubahan stok muncul di sini setelah persediaan masuk, transfer, akhir shift atau opname."
                : "Aksi seperti akhir shift dan opname akan tercatat di sini."}
            </p>
          </div>
        ) : visibleCount === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">Tidak ada yang cocok</p>
            <p className="ds-empty-text">Ubah kata kunci pencarian.</p>
          </div>
        ) : tab === "stock" ? (
          <div className="ds-table-wrap">
            <table className="ds-table is-cozy is-stack">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Item</th>
                  <th>Lokasi</th>
                  <th className="is-num">Perubahan</th>
                  <th className="is-num">Setelah</th>
                  <th>Alasan</th>
                  <th>
                    <span className="ds-sr-only">Dokumen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {stockVisible.map((r) => {
                  const href = refHref(r.ref_type, r.ref_id, r.location);
                  const reason = stockReasonLabel(r.reason);
                  return (
                    <tr key={r.id}>
                      <td data-label="Waktu" className="ds-num ds-nowrap ds-text-sm">{formatFullStamp(r.created_at)}</td>
                      <td data-title>
                        <div className="ds-cell-stack">
                          <span className="ds-cell-name">{r.item_name}</span>
                          <span className="ds-cell-sub ds-num">{r.item_sku}</span>
                        </div>
                      </td>
                      <td data-label="Lokasi" className="ds-nowrap">
                        <LocationTag location={r.location === "kitchen" ? "kitchen" : "warehouse"} size="sm" />
                      </td>
                      <td data-label="Perubahan" className="is-num ds-strong-cell ds-nowrap">
                        <Qty value={r.delta} unit={r.unit_code} signed />
                      </td>
                      <td data-label="Setelah" className="is-num ds-nowrap">
                        <Qty value={r.qty_after} unit={r.unit_code} />
                      </td>
                      <td data-label="Alasan" className="ds-ink-2">{reason}</td>
                      <td data-action className="ds-cell-right">
                        {href ? (
                          <Link
                            className="ds-link"
                            href={href}
                            aria-label={`Buka dokumen ${reason}, ${r.item_name}`}
                          >
                            Buka
                          </Link>
                        ) : (
                          <span className="ds-muted-text">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table is-cozy is-stack">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aksi</th>
                  <th>Dokumen</th>
                  <th>Keterangan</th>
                  <th>
                    <span className="ds-sr-only">Buka</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {activityVisible.map((r) => {
                  const href = entityHref(r.entity_type, r.entity_id);
                  const action = activityActionLabel(r.action);
                  return (
                    <tr key={r.id}>
                      <td data-label="Waktu" className="ds-num ds-nowrap ds-text-sm">{formatFullStamp(r.created_at)}</td>
                      <td data-title className="ds-cell-name">{action}</td>
                      <td data-label="Dokumen" className="ds-num ds-text-sm">{activityEntityLabel(r.entity_type, r.entity_id)}</td>
                      <td data-label="Keterangan" data-block className="ds-ink-2">{activityDetailLabel(r.detail)}</td>
                      <td data-action className="ds-cell-right">
                        {href ? (
                          <Link className="ds-link" href={href} aria-label={`Buka dokumen ${action}`}>
                            Buka
                          </Link>
                        ) : (
                          <span className="ds-muted-text">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && rows.length > 0 ? (
          <p className="ds-card-foot">
            {query.trim()
              ? `${visibleCount} dari ${rows.length} entri yang dimuat.`
              : rows.length >= LIMIT
                ? `Hanya ${LIMIT} entri terbaru yang dimuat. Yang lebih lama belum bisa ditampilkan di sini.`
                : `${rows.length} entri.`}
          </p>
        ) : null}
      </section>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="ds-screen">
          <p className="ds-empty-text">Memuat riwayat…</p>
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
