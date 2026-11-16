"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { IconClose } from "@/components/ui/Icons";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationTag } from "@/components/ui/LocationTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stepper } from "@/components/ui/Stepper";
import { UnitInput } from "@/components/ui/UnitInput";
import { getUser } from "@/lib/auth";
import { formatQty } from "@/lib/format";
import { kitchenApi, type Menu } from "@/lib/kitchen";
import { parseRequestFocus, showKitchenRequestActions } from "@/lib/rbac";
import {
  buildDraftLines,
  sourceLabel,
  type DraftRecipe,
  type ItemInfo,
} from "@/lib/request-draft";
import { toastSuccess } from "@/lib/toast";
import { transferApi } from "@/lib/transfer";
import { type Item, warehouseApi } from "@/lib/warehouse";

type ExtraRow = { key: number; item_id: string; qty: string };

type Loaded = {
  menus: Menu[];
  recipes: Record<string, { item_id: string; qty_per_paket: number }[]>;
  failedMenus: Set<string>;
  items: Item[];
  info: Map<string, ItemInfo>;
  stock: Map<string, number>;
};

function newRow(key: number): ExtraRow {
  return { key, item_id: "", qty: "" };
}

function NewRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focus = parseRequestFocus(searchParams.get("focus"));

  const [access, setAccess] = useState<"checking" | "ok" | "denied">("checking");
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paket, setPaket] = useState<Record<string, number>>({});
  const [extras, setExtras] = useState<ExtraRow[]>([newRow(1)]);
  const [nextKey, setNextKey] = useState(2);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [menuRows, itemRows, unitRows, stockRows] = await Promise.all([
        kitchenApi.listMenus(),
        warehouseApi.listItems(),
        warehouseApi.listUnits(),
        warehouseApi.listStocks(),
      ]);
      const active = menuRows.filter((m) => m.is_active);
      // TODO(api): GET /kitchen/menus returns no recipe lines, so each active menu needs its own GET.
      const settled = await Promise.allSettled(active.map((m) => kitchenApi.getMenu(m.id)));
      const recipes: Loaded["recipes"] = {};
      const failedMenus = new Set<string>();
      settled.forEach((result, i) => {
        if (result.status === "fulfilled") {
          recipes[active[i].id] = (result.value.lines ?? []).map((l) => ({
            item_id: l.item_id,
            qty_per_paket: l.qty_per_paket,
          }));
        } else {
          failedMenus.add(active[i].id);
        }
      });
      const unitCode = new Map(unitRows.map((u) => [u.id, u.code]));
      const info = new Map<string, ItemInfo>(
        itemRows.map((it) => [
          it.id,
          { name: it.name, sku: it.sku, unit: unitCode.get(it.unit_id) ?? "" },
        ]),
      );
      setData({
        menus: active,
        recipes,
        failedMenus,
        items: itemRows.filter((it) => it.is_active),
        info,
        stock: new Map(stockRows.map((s) => [s.item_id, s.qty])),
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    if (user && showKitchenRequestActions(user.role, focus)) {
      setAccess("ok");
      void load();
    } else {
      setAccess("denied");
      setLoading(false);
    }
  }, [focus, load]);

  const validExtras = useMemo(() => {
    const merged = new Map<string, number>();
    for (const row of extras) {
      const qty = Number(row.qty);
      if (row.item_id && qty > 0) merged.set(row.item_id, (merged.get(row.item_id) ?? 0) + qty);
    }
    return [...merged.entries()].map(([item_id, qty]) => ({ item_id, qty }));
  }, [extras]);

  const incompleteExtra = extras.some(
    (row) => (row.item_id !== "" && !(Number(row.qty) > 0)) || (row.item_id === "" && row.qty.trim() !== ""),
  );

  const draft = useMemo(() => {
    if (!data) return [];
    const recipes: DraftRecipe[] = data.menus
      .filter((m) => data.recipes[m.id])
      .map((m) => ({ menuId: m.id, lines: data.recipes[m.id] }));
    return buildDraftLines(recipes, paket, validExtras, data.info, data.stock);
  }, [data, paket, validExtras]);

  const selectedMenus = data ? data.menus.filter((m) => (paket[m.id] ?? 0) > 0) : [];
  const paketTotal = selectedMenus.reduce((sum, m) => sum + (paket[m.id] ?? 0), 0);
  const shortLines = draft.filter((l) => l.shortBy > 0);
  const hasContent = paketTotal > 0 || validExtras.length > 0;
  const canSubmit = hasContent && !incompleteExtra && !submitting;

  const blockedReason = incompleteExtra
    ? "Lengkapi item dan jumlahnya di bagian item tambahan, atau hapus barisnya."
    : !hasContent
      ? "Isi minimal satu paket menu atau satu item tambahan."
      : null;

  function updateExtra(key: number, patch: Partial<ExtraRow>) {
    setExtras((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeExtra(key: number) {
    setExtras((rows) => {
      const next = rows.filter((r) => r.key !== key);
      return next.length > 0 ? next : [newRow(nextKey)];
    });
    setNextKey((k) => k + 1);
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await transferApi.create({
        note: note.trim() || null,
        packages: selectedMenus.map((m) => ({ menu_id: m.id, qty_paket: paket[m.id] })),
        extra_items: validExtras,
      });
      toastSuccess("Permintaan diajukan ke gudang");
      router.push(`/app/stock-requests/${created.id}?focus=kitchen`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Gagal mengajukan permintaan");
      setSubmitting(false);
    }
  }

  const backHref = "/app/stock-requests?focus=kitchen";

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
          title="Permintaan hanya diajukan dari pintu dapur"
          actions={
            <LinkButton size="sm" variant="secondary" href={backHref}>
              Ke permintaan persediaan
            </LinkButton>
          }
        >
          Halaman ini untuk Admin Dapur. Super Admin bisa membukanya lewat menu Dapur, Permintaan
          persediaan.
        </InlineAlert>
      </div>
    );
  }

  return (
    <div className="ds-screen">
      <PageHeader
        kicker={<LocationTag location="kitchen" label="Pintu dapur" />}
        title="Ajukan permintaan ke gudang"
        lede="Isi berapa paket yang mau dimasak. Bahan dihitung dari resep dan digabung otomatis, jadi gudang menerima satu daftar yang rapi."
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Data menu dan stok belum bisa dimuat"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Coba lagi
            </Button>
          }
        >
          {loadError}. Tanpa data ini daftar bahan tidak bisa dihitung.
        </InlineAlert>
      ) : null}

      {loading && !data ? (
        <p className="ds-card-hint">Memuat menu dan stok gudang…</p>
      ) : null}

      {data ? (
        <div className="ds-split">
          <div className="ds-form-col">
            <section className="ds-card" aria-labelledby="menu-title">
              <div className="ds-card-head is-tight">
                <h2 id="menu-title" className="ds-card-title">
                  1. Paket menu
                </h2>
                <p className="ds-card-hint">Biarkan 0 untuk menu yang tidak dimasak</p>
              </div>
              {data.menus.length === 0 ? (
                <p className="ds-preview-empty">
                  Belum ada menu aktif. Tambahkan resep di{" "}
                  <Link href="/app/kitchen/menus">Resep / menu</Link>, atau pakai item tambahan di
                  bawah.
                </p>
              ) : (
                <ul className="ds-menu-list">
                  {data.menus.map((m) => {
                    const recipe = data.recipes[m.id];
                    const failed = data.failedMenus.has(m.id);
                    const empty = !failed && (!recipe || recipe.length === 0);
                    return (
                      <li key={m.id} className="ds-menu-row">
                        <div className="ds-cell-stack">
                          <span className="ds-menu-name">{m.name}</span>
                          <span className="ds-menu-sub">
                            {failed
                              ? "Resep tidak bisa dimuat"
                              : empty
                                ? "Resep masih kosong"
                                : `${recipe.length} bahan per paket`}
                          </span>
                        </div>
                        {failed || empty ? (
                          <LinkButton size="sm" variant="secondary" href="/app/kitchen/menus">
                            {failed ? "Buka resep" : "Isi resep dulu"}
                          </LinkButton>
                        ) : (
                          <Stepper
                            label={m.name}
                            step={5}
                            value={paket[m.id] ?? 0}
                            onChange={(n) => setPaket((p) => ({ ...p, [m.id]: n }))}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="ds-card ds-extra-block" aria-labelledby="extra-title">
              <div className="ds-cell-stack">
                <h2 id="extra-title" className="ds-card-title">
                  2. Item di luar resep <span className="ds-card-title-sub">· opsional</span>
                </h2>
                <p className="ds-card-hint">
                  Untuk stok cadangan atau bahan yang belum ada di resep.
                </p>
              </div>

              {extras.map((row, i) => {
                const unit = data.info.get(row.item_id)?.unit ?? "";
                const qtyBad = row.item_id !== "" && row.qty !== "" && !(Number(row.qty) > 0);
                return (
                  <div key={row.key} className="ds-extra-row">
                    <label className="ds-field">
                      Item
                      <select
                        className="ds-select"
                        value={row.item_id}
                        onChange={(e) => updateExtra(row.key, { item_id: e.target.value })}
                      >
                        <option value="">Pilih item…</option>
                        {data.items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({data.info.get(it.id)?.unit ?? "?"})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="ds-field">
                      Jumlah
                      <UnitInput
                        unit={unit}
                        min={0}
                        step="any"
                        value={row.qty}
                        invalid={qtyBad}
                        aria-label={`Jumlah item tambahan ${i + 1}`}
                        onChange={(e) => updateExtra(row.key, { qty: e.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      className="ds-icon-btn"
                      aria-label={`Hapus item tambahan ${i + 1}`}
                      onClick={() => removeExtra(row.key)}
                    >
                      <IconClose size={18} />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                className="ds-add-row"
                onClick={() => {
                  setExtras((rows) => [...rows, newRow(nextKey)]);
                  setNextKey((k) => k + 1);
                }}
              >
                + Tambah item
              </button>
            </section>

            <section className="ds-card ds-note-card" aria-labelledby="note-title">
              <label className="ds-field">
                <span id="note-title">
                  3. Catatan untuk gudang{" "}
                  <span className="ds-field-hint">Opsional, misalnya kapan barang dibutuhkan</span>
                </span>
                <textarea
                  className="ds-textarea"
                  rows={2}
                  placeholder="Contoh: butuh sebelum jam 10 untuk persiapan makan siang"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </section>
          </div>

          <section className="ds-card ds-preview" aria-labelledby="prev-title">
            <div className="ds-preview-head">
              <h2 id="prev-title" className="ds-card-title">
                Yang akan diterima gudang
              </h2>
              <p className="ds-card-hint">
                {hasContent ? (
                  <>
                    <span className="ds-num">{formatQty(paketTotal)}</span> paket dari{" "}
                    <span className="ds-num">{selectedMenus.length}</span> menu ·{" "}
                    <span className="ds-num">{draft.length}</span> bahan setelah digabung
                  </>
                ) : (
                  "Belum ada yang diisi"
                )}
              </p>
            </div>

            {draft.length === 0 ? (
              <p className="ds-preview-empty">
                Isi jumlah paket atau tambah item. Daftar bahan untuk gudang muncul di sini.
              </p>
            ) : (
              <ul className="ds-preview-list">
                {draft.map((l) => (
                  <li key={l.item_id} className="ds-preview-row">
                    <span className="ds-preview-name">{l.name}</span>
                    <span className="ds-num ds-preview-qty">{formatQty(l.qty, l.unit)}</span>
                    <span className="ds-preview-meta">{sourceLabel(l)}</span>
                    <span
                      className={`ds-preview-meta is-end${l.shortBy > 0 ? " is-short" : ""}`}
                    >
                      {l.shortBy > 0 ? (
                        <>
                          gudang kurang{" "}
                          <span className="ds-num">{formatQty(l.shortBy, l.unit)}</span>
                        </>
                      ) : l.stock !== null ? (
                        <>
                          gudang punya{" "}
                          <span className="ds-num">{formatQty(l.stock, l.unit)}</span>
                        </>
                      ) : (
                        "stok gudang tidak diketahui"
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="ds-preview-foot">
              {shortLines.length > 0 ? (
                <InlineAlert
                  tone="warn"
                  title={`Gudang belum punya cukup ${shortLines.length} bahan`}
                >
                  {shortLines
                    .map((l) => `${l.name} kurang ${formatQty(l.shortBy, l.unit)}`)
                    .join(", ")}
                  . Anda tetap bisa mengajukan. Gudang yang memutuskan, dan pengiriman baru bisa
                  setelah stoknya cukup.
                </InlineAlert>
              ) : null}

              {submitError ? (
                <InlineAlert role="alert" title="Permintaan belum terkirim">
                  {submitError}. Isian Anda masih ada, coba ajukan lagi.
                </InlineAlert>
              ) : null}

              {blockedReason ? (
                <p id="submit-reason" className="ds-reason">
                  {blockedReason}
                </p>
              ) : null}

              <Button
                block
                disabled={!canSubmit}
                aria-describedby={blockedReason ? "submit-reason" : undefined}
                onClick={() => void onSubmit()}
              >
                {submitting ? "Mengajukan…" : "Ajukan ke gudang"}
              </Button>
              <p className="ds-footnote">
                Isi permintaan dikunci saat diajukan, jadi perubahan resep sesudahnya tidak
                mengubah dokumen ini.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default function NewStockRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="ds-screen">
          <p className="ds-card-hint">Memuat…</p>
        </div>
      }
    >
      <NewRequestContent />
    </Suspense>
  );
}
