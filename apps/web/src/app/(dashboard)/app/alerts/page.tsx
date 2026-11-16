"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationTag, type Location } from "@/components/ui/LocationTag";
import { MinGauge } from "@/components/ui/MinGauge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Qty } from "@/components/ui/Qty";
import { StatusChip } from "@/components/ui/StatusChip";
import { FilterChips, LinkTabs } from "@/components/ui/Tabs";
import { dashboardApi, type LowStockAlert } from "@/lib/dashboard";

type LevelFilter = "all" | "critical" | "low";

const toLocation = (v: string): Location => (v === "kitchen" ? "kitchen" : "warehouse");

/** How far below the minimum an item is. Most urgent first; a missing minimum sorts last. */
const ratio = (r: LowStockAlert) =>
  r.min_stock > 0 ? r.effective_qty / r.min_stock : Number.POSITIVE_INFINITY;

function AlertsContent() {
  const searchParams = useSearchParams();
  const locationParam = searchParams.get("location");
  const location: "" | Location =
    locationParam === "warehouse" || locationParam === "kitchen" ? locationParam : "";

  const [rows, setRows] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [level, setLevel] = useState<LevelFilter>("all");
  const [query, setQuery] = useState("");

  // Everything is fetched once and split here, so the tabs can show their own counts and
  // switching between them needs no round trip.
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setRows(await dashboardApi.lowStock());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat peringatan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      warehouse: rows.filter((r) => r.location !== "kitchen").length,
      kitchen: rows.filter((r) => r.location === "kitchen").length,
    }),
    [rows],
  );

  const inLocation = useMemo(
    () => (location ? rows.filter((r) => toLocation(r.location) === location) : rows),
    [rows, location],
  );

  const levelCounts = useMemo(() => {
    const critical = inLocation.filter((r) => r.level === "critical").length;
    return { all: inLocation.length, critical, low: inLocation.length - critical };
  }, [inLocation]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inLocation
      .filter((r) => {
        if (level === "critical" && r.level !== "critical") return false;
        if (level === "low" && r.level === "critical") return false;
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          (r.category_name ?? "").toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          Number(b.level === "critical") - Number(a.level === "critical") ||
          ratio(a) - ratio(b) ||
          a.name.localeCompare(b.name, "id"),
      );
  }, [inLocation, level, query]);

  const showTransit = visible.some((r) => r.in_transit > 0);
  // After a failed load every count would read 0, which looks like "no alerts". Show none instead.
  const known = !loading && !(loadError && rows.length === 0);

  return (
<<<<<<< HEAD
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Operasional</p>
          <h1 className="page-title">Peringatan Persediaan</h1>
          <p className="lede">Item di bawah min stok (gudang &amp; dapur).</p>
        </div>
        <div className="page-header-actions">
          <Link className="btn btn-ghost" href="/app">
=======
    <div className="ds-screen">
      <PageHeader
        title="Peringatan persediaan"
        lede="Item yang stoknya sudah sama dengan atau di bawah batas minimum. Yang paling mendesak ada di atas."
        actions={
          <LinkButton href="/app" variant="secondary">
>>>>>>> origin/feat/web-redesign
            Ringkasan
          </LinkButton>
        }
      />

      <LinkTabs
        label="Lokasi"
        items={[
          { href: "/app/alerts", label: "Semua", count: known ? counts.all : undefined, active: location === "" },
          {
            href: "/app/alerts?location=warehouse",
            label: "Gudang",
            count: known ? counts.warehouse : undefined,
            active: location === "warehouse",
          },
          {
            href: "/app/alerts?location=kitchen",
            label: "Dapur",
            count: known ? counts.kitchen : undefined,
            active: location === "kitchen",
          },
        ]}
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Peringatan belum bisa dimuat"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Coba lagi
            </Button>
          }
        >
          {loadError}. Periksa koneksi Anda, lalu coba lagi.
        </InlineAlert>
      ) : null}

      <section className="ds-card ds-card-clip">
        <div className="ds-toolbar">
          <FilterChips
            label="Filter tingkat"
            value={level}
            onChange={(v) => setLevel(v as LevelFilter)}
            items={[
              { id: "all", label: "Semua", count: known ? levelCounts.all : undefined },
              { id: "critical", label: "Kritis", count: known ? levelCounts.critical : undefined },
              { id: "low", label: "Menipis", count: known ? levelCounts.low : undefined },
            ]}
          />
          <label className="ds-search">
            <span className="ds-sr-only">Cari item</span>
            <input
              type="search"
              placeholder="Cari item, SKU, kategori"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <div className="ds-empty">
            <p className="ds-empty-text">Memuat peringatan…</p>
          </div>
        ) : loadError && rows.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">Daftar belum tersedia</p>
            <p className="ds-empty-text">Gunakan “Coba lagi” di atas setelah koneksi pulih.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">
              {inLocation.length === 0 ? "Tidak ada peringatan" : "Tidak ada yang cocok"}
            </p>
            <p className="ds-empty-text">
              {inLocation.length === 0
                ? "Semua item di lokasi ini masih di atas batas minimum."
                : "Ubah filter atau kata kunci pencarian."}
            </p>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table is-cozy is-stack">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Lokasi</th>
                  <th>Kategori</th>
                  <th className="is-num">Stok</th>
                  {showTransit ? <th className="is-num">Di jalan</th> : null}
                  <th className="ds-gauge-col">Terhadap minimum</th>
                  <th>Status</th>
                  <th>
                    <span className="ds-sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const loc = toLocation(r.location);
                  return (
                    <tr key={`${r.location}-${r.item_id}`}>
                      <td data-title>
                        <div className="ds-cell-stack">
                          <span className="ds-cell-name">{r.name}</span>
                          <span className="ds-cell-sub ds-num">{r.sku}</span>
                        </div>
                      </td>
                      <td data-label="Lokasi" className="ds-nowrap">
                        <LocationTag location={loc} size="sm" />
                      </td>
                      <td data-label="Kategori" className="ds-ink-2 ds-text-sm">{r.category_name || "—"}</td>
                      <td data-label="Stok" className="is-num ds-strong-cell">
                        <Qty value={r.qty} unit={r.unit_code} />
                      </td>
                      {showTransit ? (
                        <td data-label="Di jalan" className="is-num ds-nowrap">
                          {r.in_transit > 0 ? (
                            <Qty value={r.in_transit} unit={r.unit_code} tone="warn" />
                          ) : (
                            <span className="ds-muted-text">—</span>
                          )}
                        </td>
                      ) : null}
                      <td data-label="Terhadap minimum">
                        <MinGauge
                          layout="stacked"
                          effective={r.effective_qty}
                          min={r.min_stock}
                          unit={r.unit_code}
                        />
                      </td>
                      <td data-label="Status" className="ds-nowrap">
                        {r.level === "critical" ? (
                          <StatusChip tone="danger">Kritis</StatusChip>
                        ) : (
                          <StatusChip tone="warn">Menipis</StatusChip>
                        )}
                      </td>
                      <td data-action className="ds-cell-right">
                        <Link
                          className="ds-link"
                          href={`/app/history?item_id=${r.item_id}&location=${loc}`}
                          aria-label={`Riwayat ${r.name}, ${loc === "kitchen" ? "dapur" : "gudang"}`}
                        >
                          Riwayat
                        </Link>
                      </td>
                    </tr>
                  );
                })}
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
        <div className="ds-screen">
          <p className="ds-empty-text">Memuat peringatan…</p>
        </div>
      }
    >
      <AlertsContent />
    </Suspense>
  );
}
