"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  type KeyboardEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationTag } from "@/components/ui/LocationTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { Qty } from "@/components/ui/Qty";
import { StepPills } from "@/components/ui/StepPills";
import { FilterChips } from "@/components/ui/Tabs";
import { UnitInput } from "@/components/ui/UnitInput";
import { getUser } from "@/lib/auth";
import { formatClock } from "@/lib/datetime";
import { formatQty, signedQty } from "@/lib/format";
import { kitchenApi } from "@/lib/kitchen";
import { opnameApi } from "@/lib/opname";
import { parsePhysical, summarize, varianceOf } from "@/lib/opname-calc";
import { parseRequestFocus, showOpnameMutate } from "@/lib/rbac";
import { toastSuccess } from "@/lib/toast";
import { warehouseApi } from "@/lib/warehouse";

type Row = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  categoryId: string | null;
  category: string | null;
  system: number;
};

type Loaded = { rows: Row[]; categories: { id: string; name: string }[]; openedAt: string };

function explainSaveError(message: string): { title: string; body: string } {
  if (message.includes("akses ditolak")) {
    return {
      title: "Peran Anda tidak bisa membuat opname di lokasi ini",
      body: "Buka lembar dari menu Opname gudang atau Opname dapur yang sesuai dengan peran Anda.",
    };
  }
  if (message.includes("data tidak valid")) {
    return {
      title: "Lembar belum tersimpan",
      body: "Server menolak isiannya. Pastikan tiap item hanya satu kali dan hasil hitung tidak negatif.",
    };
  }
  return { title: "Lembar belum tersimpan", body: message };
}

function focusNext(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const inputs = [...document.querySelectorAll<HTMLInputElement>("input[data-count]")];
  const at = inputs.indexOf(e.target as HTMLInputElement);
  inputs[at + 1]?.focus();
}

function NewOpnameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focus = parseRequestFocus(searchParams.get("focus"));

  const [access, setAccess] = useState<"checking" | "ok" | "denied">("checking");
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [category, setCategory] = useState("all");
  const [onlyVariance, setOnlyVariance] = useState(false);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<"list" | "detail" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!focus) return;
    setLoadError(null);
    setLoading(true);
    try {
      const [itemRows, unitRows, catRows, stockRows] = await Promise.all([
        warehouseApi.listItems(),
        warehouseApi.listUnits(),
        warehouseApi.listCategories(),
        focus === "kitchen" ? kitchenApi.listStocks() : warehouseApi.listStocks(),
      ]);
      const unitCode = new Map(unitRows.map((u) => [u.id, u.code]));
      const catName = new Map(catRows.map((c) => [c.id, c.name]));
      const stock = new Map(stockRows.map((s) => [s.item_id, s.qty]));
      const rows: Row[] = itemRows
        .filter((it) => it.is_active)
        .map((it) => ({
          id: it.id,
          sku: it.sku,
          name: it.name,
          unit: unitCode.get(it.unit_id) ?? "",
          categoryId: it.category_id ?? null,
          category: it.category_id ? (catName.get(it.category_id) ?? null) : null,
          system: stock.get(it.id) ?? 0,
        }))
        .sort(
          (a, b) =>
            (a.category ?? "~").localeCompare(b.category ?? "~", "id") ||
            a.name.localeCompare(b.name, "id"),
        );
      const used = new Set(rows.map((r) => r.categoryId));
      setData({
        rows,
        categories: catRows.filter((c) => used.has(c.id)).map((c) => ({ id: c.id, name: c.name })),
        openedAt: new Date().toISOString(),
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [focus]);

  useEffect(() => {
    const user = getUser();
    if (focus && user && showOpnameMutate(user.role, focus)) {
      setAccess("ok");
      void load();
    } else {
      setAccess("denied");
      setLoading(false);
    }
  }, [focus, load]);

  const evaluated = useMemo(
    () =>
      (data?.rows ?? []).map((r) => {
        const physical = parsePhysical(values[r.id] ?? "");
        return { row: r, physical, ...varianceOf(r.system, physical) };
      }),
    [data, values],
  );

  const summary = useMemo(() => summarize(evaluated.map((e) => e.kind)), [evaluated]);
  const invalidCount = evaluated.filter((e) => e.kind === "invalid").length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return evaluated.filter((e) => {
      if (category !== "all" && e.row.categoryId !== category) return false;
      if (q && !e.row.name.toLowerCase().includes(q) && !e.row.sku.toLowerCase().includes(q)) {
        return false;
      }
      if (onlyVariance && e.kind !== "over" && e.kind !== "under") return false;
      return true;
    });
  }, [evaluated, category, query, onlyVariance]);

  const canSave = summary.counted > 0 && invalidCount === 0 && saving === null;
  const blockedReason =
    invalidCount > 0
      ? `${invalidCount} isian tidak valid. Isi angka 0 atau lebih, atau kosongkan.`
      : summary.counted === 0
        ? "Isi hasil hitung minimal satu item."
        : null;

  async function save(next: "list" | "detail") {
    if (!canSave || !focus) return;
    setSaving(next);
    setSaveError(null);
    try {
      const created = await opnameApi.create({
        location: focus,
        note: note.trim() || null,
        lines: evaluated
          .filter((e): e is typeof e & { physical: number } => typeof e.physical === "number")
          .map((e) => ({ item_id: e.row.id, physical_qty: e.physical })),
      });
      toastSuccess(
        next === "detail"
          ? "Draf opname dibuat. Tinjau selisihnya, lalu konfirmasi."
          : "Draf opname disimpan. Stok belum berubah sampai dikonfirmasi.",
      );
      router.push(
        next === "detail"
          ? `/app/opnames/${created.id}?focus=${focus}`
          : `/app/opnames?focus=${focus}`,
      );
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Gagal menyimpan");
      setSaving(null);
    }
  }

  if (access === "checking") {
    return (
      <div className="ds-screen">
        <p className="ds-card-hint">Memuat…</p>
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="ds-screen">
        <InlineAlert
          tone="info"
          title={focus ? "Peran Anda tidak bisa membuat opname di sini" : "Pilih lokasi opname dulu"}
          actions={
            <>
              <LinkButton size="sm" variant="secondary" href="/app/opnames?focus=warehouse">
                Opname gudang
              </LinkButton>
              <LinkButton size="sm" variant="secondary" href="/app/opnames?focus=kitchen">
                Opname dapur
              </LinkButton>
            </>
          }
        >
          Lembar hitung dibuka dari menu Opname gudang atau Opname dapur, dan hanya oleh peran
          yang mengelola lokasi itu.
        </InlineAlert>
      </div>
    );
  }

  const where = focus === "kitchen" ? "dapur" : "gudang";
  const saveInfo = saveError ? explainSaveError(saveError) : null;

  return (
    <div className="ds-screen">
      <PageHeader
        kicker={
          <LocationTag
            location={focus === "kitchen" ? "kitchen" : "warehouse"}
            label={`Pintu ${where}`}
          />
        }
        title={`Opname ${where}`}
        lede="Tulis hasil hitung fisik. Stok sistem baru berubah setelah lembar ini dikonfirmasi."
        actions={<StepPills label="Langkah opname" steps={["Hitung", "Tinjau selisih", "Konfirmasi"]} current={0} />}
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Daftar item dan stok belum bisa dimuat"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Coba lagi
            </Button>
          }
        >
          {loadError}. Tanpa stok sistem selisihnya tidak bisa dihitung.
        </InlineAlert>
      ) : null}

      {loading && !data ? <p className="ds-card-hint">Memuat item dan stok {where}…</p> : null}

      {data ? (
        <>
          <section className="ds-card ds-card-clip" aria-label="Lembar hitung">
            <div className="ds-toolbar">
              <FilterChips
                label="Filter kategori"
                value={category}
                onChange={setCategory}
                items={[
                  { id: "all", label: "Semua" },
                  ...data.categories.map((c) => ({ id: c.id, label: c.name })),
                ]}
              />
              <div className="ds-toolbar-group">
                <label className="ds-check">
                  <input
                    type="checkbox"
                    checked={onlyVariance}
                    onChange={(e) => setOnlyVariance(e.target.checked)}
                  />
                  Hanya yang selisih
                </label>
                <label className="ds-search">
                  <span className="ds-sr-only">Cari item</span>
                  <input
                    type="search"
                    placeholder="Cari item atau SKU"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="ds-progress-row">
              <span className="ds-progress-text">
                <strong className="ds-num">{summary.counted}</strong> dari{" "}
                <span className="ds-num">{summary.total}</span> item dihitung
              </span>
              <div className="ds-progress-bar" aria-hidden="true">
                <div
                  className="ds-progress-fill"
                  style={{
                    width: `${summary.total === 0 ? 0 : Math.round((summary.counted / summary.total) * 100)}%`,
                  }}
                />
              </div>
              <span className="ds-progress-note">
                Qty sistem diambil saat lembar dibuka,{" "}
                <span className="ds-num">{formatClock(data.openedAt)}</span>. Kalau stok berubah
                sebelum disimpan, server menghitung ulang selisihnya.
              </span>
            </div>

            {data.rows.length === 0 ? (
              <p className="ds-preview-empty">Belum ada item aktif untuk dihitung.</p>
            ) : visible.length === 0 ? (
              <div className="ds-empty">
                <p className="ds-empty-title">Tidak ada item yang cocok</p>
                <p className="ds-empty-text">Ubah filter kategori, kata kunci, atau centang selisih.</p>
              </div>
            ) : (
              <div className="ds-table-wrap">
                <table className="ds-table is-count">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Kategori</th>
                      <th className="is-num">Qty sistem</th>
                      <th className="ds-count-col">Qty fisik</th>
                      <th className="is-num">Selisih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(({ row, kind, diff }) => (
                      <tr key={row.id}>
                        <td>
                          <div className="ds-cell-stack">
                            <span className="ds-cell-name">{row.name}</span>
                            <span className="ds-cell-sub ds-num">{row.sku}</span>
                          </div>
                        </td>
                        <td data-label="Kategori" className="ds-ink-2 ds-text-sm">
                          {row.category ?? "—"}
                        </td>
                        <td data-label="Qty sistem" className="is-num">
                          <Qty value={row.system} className="ds-ink-2" />
                        </td>
                        <td data-label="Qty fisik">
                          <UnitInput
                            className="ds-count-input"
                            data-count=""
                            unit={row.unit}
                            min={0}
                            step="any"
                            placeholder="—"
                            aria-label={`Qty fisik ${row.name}`}
                            invalid={kind === "invalid"}
                            value={values[row.id] ?? ""}
                            onKeyDown={focusNext}
                            onChange={(e) =>
                              setValues((v) => ({ ...v, [row.id]: e.target.value }))
                            }
                          />
                        </td>
                        <td data-label="Selisih" className="is-num ds-nowrap">
                          {kind === "uncounted" ? (
                            <span className="ds-var-plain">Belum dihitung</span>
                          ) : kind === "invalid" ? (
                            <span className="ds-var-plain is-invalid">Tidak valid</span>
                          ) : kind === "match" ? (
                            <span className="ds-var-plain">Cocok</span>
                          ) : (
                            <span className={`ds-var is-${kind}`}>
                              <span className="ds-num ds-var-qty">{signedQty(diff, row.unit)}</span>
                              <span className="ds-var-word">
                                {kind === "over" ? "lebih" : "kurang"}
                              </span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="ds-toolbar is-foot">
              <label className="ds-field ds-field-sm ds-grow">
                Catatan <span className="ds-field-hint">Opsional, ikut tercetak di berita acara</span>
                <input
                  className="ds-input"
                  type="text"
                  placeholder="Contoh: hitung akhir bulan, setelah restock Senin"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>
          </section>

          {saveInfo ? (
            <InlineAlert role="alert" title={saveInfo.title}>
              {saveInfo.body}
            </InlineAlert>
          ) : null}

          <section className="ds-sumbar is-sticky" aria-label="Ringkasan opname">
            <dl className="ds-sumbar-stats">
              <div>
                <dt>Cocok</dt>
                <dd className="ds-num">{formatQty(summary.match)}</dd>
              </div>
              <div>
                <dt>Lebih</dt>
                <dd className="ds-num is-over">{formatQty(summary.over)}</dd>
              </div>
              <div>
                <dt>Kurang</dt>
                <dd className="ds-num is-under">{formatQty(summary.under)}</dd>
              </div>
              <div>
                <dt>Belum dihitung</dt>
                <dd className="ds-num">{formatQty(summary.uncounted)}</dd>
              </div>
            </dl>
            <div className="ds-sumbar-side">
              <div className="ds-sumbar-actions">
                <Button variant="on-dark" disabled={!canSave} onClick={() => void save("list")}>
                  {saving === "list" ? "Menyimpan…" : "Simpan draf"}
                </Button>
                <Button
                  variant="light"
                  disabled={!canSave}
                  aria-describedby={blockedReason ? "sheet-reason" : undefined}
                  onClick={() => void save("detail")}
                >
                  {saving === "detail" ? "Menyimpan…" : "Tinjau selisih"}
                </Button>
              </div>
              <p id="sheet-reason" className="ds-sumbar-note">
                {blockedReason ?? "Hanya item yang sudah diisi yang masuk ke draf. Stok belum berubah."}
              </p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function NewOpnamePage() {
  return (
    <Suspense
      fallback={
        <div className="ds-screen">
          <p className="ds-card-hint">Memuat…</p>
        </div>
      }
    >
      <NewOpnameContent />
    </Suspense>
  );
}
