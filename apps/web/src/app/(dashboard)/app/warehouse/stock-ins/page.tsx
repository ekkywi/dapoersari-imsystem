"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationTag } from "@/components/ui/LocationTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { Qty } from "@/components/ui/Qty";
import { StatusChip } from "@/components/ui/StatusChip";
import { UnitInput } from "@/components/ui/UnitInput";
import { getUser } from "@/lib/auth";
import { daysUntil, formatExpiry, formatRecent, todayISO } from "@/lib/datetime";
import { docNo, formatQty } from "@/lib/format";
import { canMutateWarehouse } from "@/lib/rbac";
import { round3 } from "@/lib/request-stock";
import { toastSuccess } from "@/lib/toast";
import { type Item, type StockIn, type Supplier, warehouseApi } from "@/lib/warehouse";

const RECENT_LIMIT = 20;

function ExpiryCell({ iso }: { iso?: string | null }) {
  if (!iso) return <span className="ds-muted-text">—</span>;
  const days = daysUntil(iso);
  if (days < 0) return <StatusChip tone="danger">Sudah lewat</StatusChip>;
  if (days <= 7) {
    return <StatusChip tone="warn">{days === 0 ? "Hari ini" : `${days} hari lagi`}</StatusChip>;
  }
  return <span className="ds-num ds-ink-2">{formatExpiry(iso)}</span>;
}

export default function StockInsPage() {
  const router = useRouter();
  const itemRef = useRef<HTMLSelectElement>(null);

  const [rows, setRows] = useState<StockIn[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [unitCode, setUnitCode] = useState<Map<string, string>>(() => new Map());
  const [stock, setStock] = useState<Map<string, number>>(() => new Map());
  const [query, setQuery] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [expiredAt, setExpiredAt] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"print" | "next" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [ins, itemRows, supplierRows, unitRows, stockRows] = await Promise.all([
        warehouseApi.listStockIns(),
        warehouseApi.listItems(),
        warehouseApi.listSuppliers(),
        warehouseApi.listUnits(),
        warehouseApi.listStocks(),
      ]);
      setRows(ins);
      setItems(itemRows);
      setSuppliers(supplierRows);
      setUnitCode(new Map(unitRows.map((u) => [u.id, u.code])));
      setStock(new Map(stockRows.map((s) => [s.item_id, s.qty])));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat persediaan masuk");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setCanWrite(user ? canMutateWarehouse(user.role) : false);
    void load();
  }, [load]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const activeItems = useMemo(
    () => items.filter((i) => i.is_active).sort((a, b) => a.name.localeCompare(b.name, "id")),
    [items],
  );
  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.is_active), [suppliers]);

  const item = itemById.get(itemId);
  const unit = item ? (unitCode.get(item.unit_id) ?? "") : "";
  const qtyNum = Number(qty);
  const qtyOk = qty.trim() !== "" && qtyNum > 0;
  const before = stock.get(itemId) ?? 0;
  const expiredPast = expiredAt !== "" && expiredAt < todayISO();

  const blockedReason = !itemId
    ? "Pilih item yang diterima."
    : !qtyOk
      ? "Isi jumlah yang diterima, lebih dari 0."
      : null;
  const canSave = canWrite && blockedReason === null && saving === null;

  const recent = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...rows]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .filter((r) => {
        if (!q) return true;
        const it = itemById.get(r.item_id);
        const sup = r.supplier_id ? (supplierById.get(r.supplier_id) ?? "") : "";
        return (
          (it?.name ?? "").toLowerCase().includes(q) ||
          (it?.sku ?? "").toLowerCase().includes(q) ||
          sup.toLowerCase().includes(q) ||
          docNo("SIN", r.id).toLowerCase().includes(q)
        );
      })
      .slice(0, RECENT_LIMIT);
  }, [rows, query, itemById, supplierById]);

  async function save(mode: "print" | "next") {
    if (!canSave) return;
    setSaving(mode);
    setSaveError(null);
    try {
      const res = await warehouseApi.createStockIn({
        item_id: itemId,
        supplier_id: supplierId || null,
        qty: qtyNum,
        note: note.trim() || null,
        expired_at: expiredAt ? new Date(`${expiredAt}T00:00:00.000Z`).toISOString() : null,
      });
      const number = docNo("SIN", res.stock_in.id);
      if (mode === "print") {
        toastSuccess(`${number} tercatat. Stok gudang sekarang ${formatQty(res.stock.qty, unit)}.`);
        router.push(`/app/warehouse/stock-ins/${res.stock_in.id}?print=1`);
        return;
      }
      toastSuccess(`${number} tercatat. ${item?.name} sekarang ${formatQty(res.stock.qty, unit)}.`);
      setRows((prev) => [res.stock_in, ...prev]);
      setStock((prev) => new Map(prev).set(itemId, res.stock.qty));
      // The supplier stays: a delivery usually has several lines from the same supplier.
      setItemId("");
      setQty("");
      setExpiredAt("");
      setNote("");
      setSaving(null);
      itemRef.current?.focus();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Gagal mencatat persediaan masuk");
      setSaving(null);
    }
  }

  return (
    <div className="ds-screen">
      <PageHeader
        kicker={<LocationTag location="warehouse" label="Pintu gudang" />}
        title="Persediaan masuk"
        lede="Catat barang dari pemasok. Satu baris per item, berita acaranya bisa langsung dicetak."
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Data persediaan masuk belum bisa dimuat"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Coba lagi
            </Button>
          }
        >
          {loadError}. Periksa koneksi Anda, lalu coba lagi.
        </InlineAlert>
      ) : null}

      <div className="ds-split">
        {canWrite ? (
          <form
            className="ds-card ds-receipt"
            aria-labelledby="form-title"
            onSubmit={(e) => {
              e.preventDefault();
              void save("next");
            }}
          >
            <h2 id="form-title" className="ds-card-title">
              Catat penerimaan
            </h2>

            <label className="ds-field ds-field-sm">
              Pemasok
              <select
                className="ds-select"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                {activeSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="">— Tanpa pemasok —</option>
              </select>
            </label>

            <label className="ds-field ds-field-sm">
              Item
              <select
                ref={itemRef}
                className="ds-select"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
              >
                <option value="">Pilih item…</option>
                {activeItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {i.sku}
                  </option>
                ))}
              </select>
            </label>

            <div className="ds-field-row">
              <label className="ds-field ds-field-sm">
                Jumlah diterima
                <UnitInput
                  unit={unit}
                  min={0}
                  step="any"
                  value={qty}
                  invalid={qty !== "" && !qtyOk}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
              <label className="ds-field ds-field-sm">
                Kedaluwarsa <span className="ds-field-hint">Opsional</span>
                <input
                  className="ds-input"
                  type="date"
                  value={expiredAt}
                  onChange={(e) => setExpiredAt(e.target.value)}
                />
              </label>
            </div>

            {expiredPast ? (
              <InlineAlert tone="warn" title="Tanggal kedaluwarsa sudah lewat">
                Pastikan barang ini memang boleh diterima dan disimpan.
              </InlineAlert>
            ) : null}

            <div className="ds-receipt-preview">
              <span>Stok gudang</span>
              {item ? (
                <span className="ds-num">
                  <span className="ds-muted-text">{formatQty(before)}</span>
                  {qtyOk ? (
                    <>
                      {" "}
                      <span aria-hidden="true" className="ds-muted-text">
                        →
                      </span>
                      <span className="ds-sr-only"> menjadi </span>{" "}
                      <strong>{formatQty(round3(before + qtyNum))}</strong>
                    </>
                  ) : null}{" "}
                  {unit}
                </span>
              ) : (
                <span className="ds-muted-text">Pilih item dulu</span>
              )}
            </div>

            <label className="ds-field ds-field-sm">
              Catatan <span className="ds-field-hint">Opsional, misalnya nomor nota pemasok</span>
              <input
                className="ds-input"
                type="text"
                placeholder="Nota #"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            {saveError ? (
              <InlineAlert role="alert" title="Penerimaan belum tercatat">
                {saveError}. Isian Anda masih ada, coba simpan lagi.
              </InlineAlert>
            ) : null}

            {blockedReason ? (
              <p id="receipt-reason" className="ds-reason">
                {blockedReason}
              </p>
            ) : null}

            <div className="ds-receipt-actions">
              <Button
                disabled={!canSave}
                aria-describedby={blockedReason ? "receipt-reason" : undefined}
                onClick={() => void save("print")}
              >
                {saving === "print" ? "Menyimpan…" : "Simpan & cetak berita acara"}
              </Button>
              <Button
                variant="secondary"
                disabled={!canSave}
                aria-describedby={blockedReason ? "receipt-reason" : undefined}
                onClick={() => void save("next")}
              >
                {saving === "next" ? "Menyimpan…" : "Simpan, catat item berikutnya"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="ds-receipt-note">
            <InlineAlert tone="info" title="Hanya Admin Gudang yang bisa mencatat penerimaan">
              Anda masih bisa melihat penerimaan terbaru dan mencetak berita acaranya.
            </InlineAlert>
          </div>
        )}

        <section className="ds-card ds-card-clip ds-recent" aria-labelledby="recent-title">
          <div className="ds-card-head">
            <h2 id="recent-title" className="ds-card-title">
              Penerimaan terbaru
            </h2>
            <label className="ds-search">
              <span className="ds-sr-only">Cari penerimaan</span>
              <input
                type="search"
                placeholder="Cari item atau pemasok"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          {loading ? (
            <div className="ds-empty">
              <p className="ds-empty-text">Memuat penerimaan…</p>
            </div>
          ) : recent.length === 0 ? (
            <div className="ds-empty">
              <p className="ds-empty-title">
                {query.trim() ? "Tidak ada yang cocok" : "Belum ada penerimaan"}
              </p>
              <p className="ds-empty-text">
                {query.trim()
                  ? "Coba nama item, pemasok, atau nomor dokumen yang lain."
                  : "Penerimaan yang dicatat muncul di sini."}
              </p>
            </div>
          ) : (
            <div className="ds-table-wrap">
              <table className="ds-table is-tight is-snug is-stack">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Item</th>
                    <th>Pemasok</th>
                    <th className="is-num">Jumlah</th>
                    <th>Kedaluwarsa</th>
                    <th>
                      <span className="ds-sr-only">Dokumen</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => {
                    const it = itemById.get(r.item_id);
                    const u = it ? (unitCode.get(it.unit_id) ?? "") : "";
                    return (
                      <tr key={r.id}>
                        <td data-label="Waktu">
                          <div className="ds-cell-stack">
                            <span className="ds-num">{formatRecent(r.created_at)}</span>
                            <span className="ds-cell-sub ds-num">{docNo("SIN", r.id)}</span>
                          </div>
                        </td>
                        <td data-title className="ds-cell-name">{it?.name ?? "Item tidak dikenal"}</td>
                        <td data-label="Pemasok" className="ds-ink-2">
                          {r.supplier_id ? (supplierById.get(r.supplier_id) ?? "—") : "—"}
                        </td>
                        <td data-label="Jumlah" className="is-num ds-strong-cell">
                          <Qty value={r.qty} unit={u} />
                        </td>
                        <td data-label="Kedaluwarsa">
                          <ExpiryCell iso={r.expired_at} />
                        </td>
                        <td data-action className="ds-cell-right">
                          <Link className="ds-link" href={`/app/warehouse/stock-ins/${r.id}`}>
                            Berita acara
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
    </div>
  );
}
