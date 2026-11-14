"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EntityDrawer } from "@/components/features/EntityDrawer";
import { MasterHeader } from "@/components/features/MasterHeader";
import { StatusToggle } from "@/components/features/StatusToggle";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationShape } from "@/components/ui/LocationTag";
import { Qty } from "@/components/ui/Qty";
import { UnitInput } from "@/components/ui/UnitInput";
import { getUser } from "@/lib/auth";
import { kitchenApi } from "@/lib/kitchen";
import { explainMasterError, normalizeSku, suggestSku } from "@/lib/master";
import { canMutateWarehouse } from "@/lib/rbac";
import { stockLevel } from "@/lib/stock-level";
import { toastSuccess } from "@/lib/toast";
import { type Category, type Item, type Unit, warehouseApi } from "@/lib/warehouse";

function levelClass(qty: number | undefined, min: number): string {
  if (qty === undefined || min <= 0) return "";
  const level = stockLevel(qty, min);
  return level === "critical" ? "ds-tone-danger" : level === "low" ? "ds-tone-low" : "";
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [whStock, setWhStock] = useState<Map<string, number>>(() => new Map());
  const [kitStock, setKitStock] = useState<Map<string, number>>(() => new Map());
  const [recipeCount, setRecipeCount] = useState<Map<string, number> | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [drawer, setDrawer] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [skuTouched, setSkuTouched] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [itemRows, unitRows, catRows, wh, kit] = await Promise.all([
        warehouseApi.listItems(),
        warehouseApi.listUnits(),
        warehouseApi.listCategories(),
        warehouseApi.listStocks(),
        kitchenApi.listStocks(),
      ]);
      setItems(itemRows);
      setUnits(unitRows);
      setCategories(catRows);
      setWhStock(new Map(wh.map((s) => [s.item_id, s.qty])));
      setKitStock(new Map(kit.map((s) => [s.item_id, s.qty])));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat item");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setCanWrite(user ? canMutateWarehouse(user.role) : false);
    void load();
  }, [load]);

  // "Dipakai di" is optional context, so it loads after the table and never blocks it.
  // TODO(api): recipe lines are not in GET /kitchen/menus; this needs one GET per active menu.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const menus = (await kitchenApi.listMenus()).filter((m) => m.is_active);
        const details = await Promise.all(menus.map((m) => kitchenApi.getMenu(m.id)));
        const count = new Map<string, number>();
        for (const d of details) {
          for (const itemId of new Set((d.lines ?? []).map((l) => l.item_id))) {
            count.set(itemId, (count.get(itemId) ?? 0) + 1);
          }
        }
        if (alive) setRecipeCount(count);
      } catch {
        if (alive) setRecipeCount(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const unitCode = useMemo(() => new Map(units.map((u) => [u.id, u.code])), [units]);
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...items]
      .sort((a, b) => a.sku.localeCompare(b.sku, "id"))
      .filter((it) => {
        if (!q) return true;
        const cat = it.category_id ? (catName.get(it.category_id) ?? "") : "";
        return (
          it.sku.toLowerCase().includes(q) ||
          it.name.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q)
        );
      });
  }, [items, query, catName]);

  function openCreate() {
    setEditing(null);
    setName("");
    setSku("");
    setSkuTouched(false);
    setUnitId(units[0]?.id ?? "");
    setCategoryId("");
    setMinStock("0");
    setSaveError(null);
    setDrawer("create");
  }

  function openEdit(it: Item) {
    if (!canWrite) return;
    setEditing(it);
    setName(it.name);
    setSku(it.sku);
    setSkuTouched(true);
    setUnitId(it.unit_id);
    setCategoryId(it.category_id ?? "");
    setMinStock(String(it.min_stock));
    setSaveError(null);
    setDrawer("edit");
  }

  function closeDrawer() {
    setDrawer(null);
    setEditing(null);
    setSaveError(null);
  }

  const skuNorm = normalizeSku(sku);
  const taken = items.find((i) => i.sku.toUpperCase() === skuNorm && i.id !== editing?.id);
  const minNum = Number(minStock);
  const reason =
    name.trim() === ""
      ? "Nama item wajib diisi."
      : skuNorm === ""
        ? "SKU wajib diisi."
        : taken
          ? `SKU ${skuNorm} sudah dipakai ${taken.name}.`
          : unitId === ""
            ? "Pilih satuan."
            : !Number.isFinite(minNum) || minNum < 0
              ? "Stok minimum tidak boleh negatif."
              : null;

  async function save() {
    if (reason !== null) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (drawer === "create") {
        await warehouseApi.createItem({
          sku: skuNorm,
          name: name.trim(),
          unit_id: unitId,
          category_id: categoryId || null,
          min_stock: minNum,
        });
        toastSuccess(`${name.trim()} ditambahkan. Stok awalnya 0.`);
      } else if (drawer === "edit" && editing) {
        const body: Parameters<typeof warehouseApi.patchItem>[1] = {
          sku: skuNorm,
          name: name.trim(),
          min_stock: minNum,
        };
        if (categoryId) body.category_id = categoryId;
        else body.clear_category = true;
        await warehouseApi.patchItem(editing.id, body);
        toastSuccess("Item diperbarui");
      }
      closeDrawer();
      await load();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setSaveError(explainMasterError(e instanceof Error ? e.message : "Gagal menyimpan", "SKU"));
    } finally {
      setSaving(false);
    }
  }

  async function setActive(next: boolean) {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      await warehouseApi.patchItem(editing.id, { is_active: next });
      toastSuccess(next ? "Item diaktifkan" : "Item dinonaktifkan");
      closeDrawer();
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Gagal mengubah status");
    } finally {
      setSaving(false);
    }
  }

  const noUnits = units.length === 0 && !loading;
  const unit = unitCode.get(unitId) ?? "";

  return (
    <div className="ds-screen">
      <MasterHeader
        active="items"
        refreshKey={refreshKey}
        action={
          canWrite
            ? {
                label: "Tambah item",
                onClick: openCreate,
                disabled: noUnits,
                reason: "Buat satuan dulu di tab Satuan.",
              }
            : undefined
        }
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Daftar item belum bisa dimuat"
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
          <label className="ds-search">
            <span className="ds-sr-only">Cari item</span>
            <input
              type="search"
              placeholder="Cari SKU, nama, kategori"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {canWrite ? <p className="ds-card-hint">Klik baris untuk mengubah</p> : null}
        </div>

        {loading ? (
          <div className="ds-empty">
            <p className="ds-empty-text">Memuat item…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">{items.length === 0 ? "Belum ada item" : "Tidak ada yang cocok"}</p>
            <p className="ds-empty-text">
              {items.length === 0
                ? noUnits
                  ? "Buat satuan dulu, lalu tambahkan item pertama."
                  : "Tambahkan item pertama untuk mulai mencatat persediaan."
                : "Coba SKU, nama, atau kategori yang lain."}
            </p>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table is-tight">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nama</th>
                  <th>Kategori</th>
                  <th>Satuan</th>
                  <th className="is-num">Minimum</th>
                  <th className="is-num">
                    <span className="ds-th-loc">
                      <LocationShape location="warehouse" /> Gudang
                    </span>
                  </th>
                  <th className="is-num">
                    <span className="ds-th-loc">
                      <LocationShape location="kitchen" /> Dapur
                    </span>
                  </th>
                  <th>Dipakai di</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((it) => {
                  const used = recipeCount?.get(it.id) ?? 0;
                  return (
                    <tr
                      key={it.id}
                      className={`${canWrite ? "is-clickable" : ""}${it.is_active ? "" : " is-inactive"}`.trim() || undefined}
                      onClick={canWrite ? () => openEdit(it) : undefined}
                    >
                      <td className="ds-num">
                        {canWrite ? (
                          <button
                            type="button"
                            className="ds-row-btn ds-num"
                            aria-label={`Ubah ${it.name}`}
                          >
                            {it.sku}
                          </button>
                        ) : (
                          <strong>{it.sku}</strong>
                        )}
                      </td>
                      <td>{it.name}</td>
                      <td className="ds-ink-2">
                        {it.category_id ? (catName.get(it.category_id) ?? "—") : "—"}
                      </td>
                      <td className="ds-num">{unitCode.get(it.unit_id) ?? "—"}</td>
                      <td className="is-num">
                        <Qty value={it.min_stock} />
                      </td>
                      <td className={`is-num ${levelClass(whStock.get(it.id), it.min_stock)}`.trim()}>
                        <Qty value={whStock.get(it.id) ?? 0} />
                      </td>
                      <td className={`is-num ${levelClass(kitStock.get(it.id), it.min_stock)}`.trim()}>
                        <Qty value={kitStock.get(it.id) ?? 0} />
                      </td>
                      <td className="ds-ink-2 ds-text-sm">
                        {used > 0 ? `${used} resep` : "—"}
                      </td>
                      <td className="ds-text-sm">
                        {it.is_active ? (
                          <span className="ds-status-active">Aktif</span>
                        ) : (
                          <span>Nonaktif</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EntityDrawer
        open={drawer !== null}
        title={drawer === "edit" ? "Edit item" : "Tambah item"}
        description={
          drawer === "edit"
            ? "Satuan tidak bisa diubah setelah item dibuat."
            : "Langsung bisa dipakai di resep dan permintaan."
        }
        onClose={closeDrawer}
        onSubmit={() => void save()}
        submitLabel={drawer === "edit" ? "Simpan perubahan" : "Simpan item"}
        saving={saving}
        canSubmit={reason === null}
        reason={reason}
        error={saveError}
      >
        <label className="ds-field ds-field-sm">
          Nama item
          <input
            className="ds-input"
            type="text"
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              if (drawer === "create" && !skuTouched) {
                setSku(
                  suggestSku(
                    e.target.value,
                    items.map((i) => i.sku),
                  ),
                );
              }
            }}
          />
        </label>

        <label className="ds-field ds-field-sm">
          SKU
          <input
            className="ds-input ds-num"
            type="text"
            value={sku}
            aria-invalid={taken ? true : undefined}
            onChange={(e) => {
              setSku(e.target.value);
              setSkuTouched(true);
            }}
          />
          <span className={taken ? "ds-field-hint ds-note-danger" : "ds-field-hint"}>
            {taken
              ? `Sudah dipakai ${taken.name}.`
              : drawer === "create"
                ? "Disarankan dari nama. SKU tidak bisa dipakai dua kali."
                : "SKU tidak bisa dipakai dua kali."}
          </span>
        </label>

        <div className="ds-field-row">
          <label className="ds-field ds-field-sm">
            Satuan
            <select
              className="ds-select"
              value={unitId}
              disabled={drawer === "edit"}
              onChange={(e) => setUnitId(e.target.value)}
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ds-field ds-field-sm">
            Kategori
            <select
              className="ds-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">— Tanpa kategori —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="ds-field ds-field-sm">
          Stok minimum
          <div className="ds-narrow">
            <UnitInput
              unit={unit}
              min={0}
              step="any"
              value={minStock}
              invalid={!Number.isFinite(minNum) || minNum < 0}
              onChange={(e) => setMinStock(e.target.value)}
            />
          </div>
          <span className="ds-field-hint">
            Peringatan muncul saat stok sama dengan atau di bawah angka ini.
          </span>
        </label>

        {drawer === "create" ? (
          <p className="ds-infobox">
            Stok awal <strong className="ds-num">0</strong> di gudang dan dapur. Tambah stok lewat{" "}
            <Link href="/app/warehouse/stock-ins">Persediaan masuk</Link>, bukan dari sini.
          </p>
        ) : null}

        {drawer === "edit" && editing ? (
          <StatusToggle
            key={editing.id}
            active={editing.is_active}
            noun="item"
            busy={saving}
            consequence="Item tidak bisa dipilih di transaksi baru. Riwayat dan dokumen lama tetap ada."
            onConfirm={() => void setActive(!editing.is_active)}
          />
        ) : null}
      </EntityDrawer>
    </div>
  );
}
