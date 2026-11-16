"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EntityDrawer } from "@/components/features/EntityDrawer";
import { StatusToggle } from "@/components/features/StatusToggle";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { IconClose } from "@/components/ui/Icons";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationTag } from "@/components/ui/LocationTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { Qty } from "@/components/ui/Qty";
import { FilterChips } from "@/components/ui/Tabs";
import { UnitInput } from "@/components/ui/UnitInput";
import { getUser } from "@/lib/auth";
import { formatQty } from "@/lib/format";
import { kitchenApi, type Menu, type RecipeLine } from "@/lib/kitchen";
import { canMutateKitchen } from "@/lib/rbac";
import { toastSuccess } from "@/lib/toast";
import { type Item, type Unit, warehouseApi } from "@/lib/warehouse";

type Filter = "all" | "active" | "inactive";
type DraftRow = { key: number; item_id: string; qty: string };

const PREVIEW = 3;

function explainMenuError(message: string): string {
  // The API answers 400 "data tidak valid" for a repeated ingredient or qty <= 0, and a bare
  // "gagal …" when the database refuses; neither says which line is wrong.
  if (message.startsWith("gagal") || message === "data tidak valid") {
    return "Server menolak data ini. Periksa nama menu, bahan (satu bahan hanya sekali per resep) dan qty (harus lebih dari 0).";
  }
  if (message === "data tidak ditemukan") {
    return "Menu atau salah satu bahan tidak ditemukan. Muat ulang halaman, lalu coba lagi.";
  }
  return message;
}

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  // Recipe lines per menu. The list endpoint carries none, so they are fetched once per menu.
  // TODO(api): return lines in GET /kitchen/menus.
  const [recipes, setRecipes] = useState<Record<string, RecipeLine[]>>({});
  const [recipesState, setRecipesState] = useState<"loading" | "ready" | "partial">("loading");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const [drawer, setDrawer] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Menu | null>(null);
  const [viewing, setViewing] = useState<Menu | null>(null);
  const [name, setName] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [menuRows, itemRows, unitRows] = await Promise.all([
        kitchenApi.listMenus(),
        warehouseApi.listItems(),
        warehouseApi.listUnits(),
      ]);
      setMenus(menuRows);
      setItems(itemRows);
      setUnits(unitRows);
      setLoading(false);

      const settled = await Promise.allSettled(menuRows.map((m) => kitchenApi.getMenu(m.id)));
      const next: Record<string, RecipeLine[]> = {};
      let failed = false;
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") next[menuRows[i].id] = r.value.lines ?? [];
        else failed = true;
      });
      setRecipes(next);
      setRecipesState(failed ? "partial" : "ready");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat menu");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setCanWrite(user ? canMutateKitchen(user.role) : false);
    void load();
  }, [load]);

  const unitCode = useMemo(() => new Map(units.map((u) => [u.id, u.code])), [units]);
  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const activeItems = useMemo(() => items.filter((it) => it.is_active), [items]);

  const counts = useMemo(() => {
    const active = menus.filter((m) => m.is_active).length;
    return { all: menus.length, active, inactive: menus.length - active };
  }, [menus]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menus
      .filter((m) => {
        if (filter === "active" && !m.is_active) return false;
        if (filter === "inactive" && m.is_active) return false;
        if (!q) return true;
        if (m.name.toLowerCase().includes(q)) return true;
        return (recipes[m.id] ?? []).some((l) => (l.item_name ?? "").toLowerCase().includes(q));
      })
      .sort(
        (a, b) =>
          Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, "id"),
      );
  }, [menus, filter, query, recipes]);

  function newRow(key: number, item_id = "", qty = ""): DraftRow {
    return { key, item_id, qty };
  }

  function resetForm(menu: Menu | null, lines: RecipeLine[]) {
    setEditing(menu);
    setName(menu?.name ?? "");
    if (lines.length > 0) {
      setRows(lines.map((l, i) => newRow(i + 1, l.item_id, String(l.qty_per_paket))));
      setNextKey(lines.length + 1);
    } else {
      setRows([newRow(1)]);
      setNextKey(2);
    }
    setSaveError(null);
  }

  function openCreate() {
    resetForm(null, []);
    setDrawer("create");
  }

  async function openMenu(m: Menu) {
    setOpenError(null);
    let lines = recipes[m.id];
    if (!lines) {
      try {
        lines = (await kitchenApi.getMenu(m.id)).lines ?? [];
      } catch (e) {
        setOpenError(
          `Resep ${m.name} belum bisa dimuat: ${e instanceof Error ? e.message : "gagal memuat"}. Coba lagi.`,
        );
        return;
      }
    }
    if (canWrite) {
      resetForm(m, lines);
      setDrawer("edit");
    } else {
      setViewing(m);
    }
  }

  function closeDrawer() {
    setDrawer(null);
    setEditing(null);
    setSaveError(null);
  }

  function updateRow(key: number, patch: Partial<DraftRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, newRow(nextKey)]);
    setNextKey((k) => k + 1);
  }

  // Items offered in a row: every active item, plus the one that row already holds (an inactive
  // ingredient of an old recipe must stay visible so it can be replaced on purpose, but must not
  // become a choice for the other rows).
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name, "id")),
    [items],
  );

  const trimmed = name.trim();
  const sameName = menus.find(
    (m) => m.id !== editing?.id && m.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );

  // First thing wrong, in the order the form reads. null = ready to save.
  const reason = useMemo((): string | null => {
    if (trimmed === "") return "Nama menu wajib diisi.";
    if (sameName) {
      return sameName.is_active
        ? `Menu ${sameName.name} sudah ada. Pakai nama lain.`
        : `Menu ${sameName.name} sudah ada tetapi nonaktif. Aktifkan menu itu atau pakai nama lain.`;
    }
    if (rows.length === 0) return "Tambahkan minimal satu bahan.";
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].item_id === "") return `Pilih bahan di baris ${i + 1}, atau hapus barisnya.`;
    }
    for (let i = 0; i < rows.length; i++) {
      if (!(Number(rows[i].qty) > 0)) {
        return `Isi qty per paket di baris ${i + 1}. Harus lebih dari 0.`;
      }
    }
    const seen = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const first = seen.get(rows[i].item_id);
      if (first !== undefined) {
        const label = itemById.get(rows[i].item_id)?.name ?? "Bahan ini";
        return `${label} dipilih di baris ${first + 1} dan ${i + 1}. Satu bahan cukup sekali per resep.`;
      }
      seen.set(rows[i].item_id, i);
    }
    return null;
  }, [trimmed, sameName, rows, itemById]);

  async function save() {
    if (reason !== null) return;
    setSaving(true);
    setSaveError(null);
    const lines = rows.map((r) => ({ item_id: r.item_id, qty_per_paket: Number(r.qty) }));
    try {
      if (drawer === "create") {
        await kitchenApi.createMenu({ name: trimmed, lines });
        toastSuccess(`Menu ${trimmed} ditambahkan`);
      } else if (editing) {
        const renamed = trimmed !== editing.name;
        if (renamed) await kitchenApi.patchMenu(editing.id, { name: trimmed });
        try {
          await kitchenApi.replaceRecipe(editing.id, { lines });
        } catch (e) {
          if (renamed) {
            // Two requests, so the first can land while the second fails. Say so instead of
            // leaving the user to guess what was saved.
            setEditing({ ...editing, name: trimmed });
            void load();
            setSaveError(
              `Nama menu sudah tersimpan, tetapi resepnya belum. ${explainMenuError(e instanceof Error ? e.message : "Gagal menyimpan")}`,
            );
            return;
          }
          throw e;
        }
        toastSuccess("Resep diperbarui");
      }
      closeDrawer();
      await load();
    } catch (e) {
      setSaveError(explainMenuError(e instanceof Error ? e.message : "Gagal menyimpan"));
    } finally {
      setSaving(false);
    }
  }

  async function setActive(next: boolean) {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      await kitchenApi.patchMenu(editing.id, { is_active: next });
      toastSuccess(next ? "Menu diaktifkan" : "Menu dinonaktifkan");
      closeDrawer();
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Gagal mengubah status");
    } finally {
      setSaving(false);
    }
  }

  function summary(m: Menu): string {
    const lines = recipes[m.id];
    if (!lines) return recipesState === "loading" ? "Memuat bahan…" : "—";
    const shown = lines
      .slice(0, PREVIEW)
      .map((l) => `${l.item_name ?? "?"} ${formatQty(l.qty_per_paket, l.unit_code)}`);
    if (lines.length > PREVIEW) shown.push(`+${lines.length - PREVIEW} lagi`);
    return shown.join(" · ");
  }

  // After a failed load the item list is empty too, which must not read as "no active items".
  // After a failed load every count would read 0, which looks like "no menus". Show none instead.
  const known = !loading && !(loadError && menus.length === 0);
  const noItems = canWrite && !loading && !loadError && activeItems.length === 0;
  const addBlockedReason = loadError
    ? "Daftar menu belum bisa dimuat. Coba lagi dulu."
    : noItems
      ? "Belum ada item aktif. Tambahkan item di Master data dulu."
      : undefined;
  const viewingLines = viewing ? (recipes[viewing.id] ?? []) : [];

  return (
    <div className="ds-screen">
      <PageHeader
        kicker={<LocationTag location="kitchen" label="Pintu dapur" />}
        title="Resep / menu"
        lede="Bahan yang terpakai untuk satu paket tiap menu. Akhir shift memakai resep ini untuk mengurangi stok dapur."
        actions={
          canWrite ? (
            <Button disabled={loading || addBlockedReason !== undefined} onClick={openCreate}>
              Tambah menu
            </Button>
          ) : undefined
        }
        actionsNote={canWrite ? addBlockedReason : undefined}
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Daftar menu belum bisa dimuat"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Coba lagi
            </Button>
          }
        >
          {loadError}. Periksa koneksi Anda, lalu coba lagi.
        </InlineAlert>
      ) : null}

      {openError ? (
        <InlineAlert role="alert" title="Resep belum bisa dibuka">
          {openError}
        </InlineAlert>
      ) : null}

      {recipesState === "partial" ? (
        <InlineAlert
          tone="warn"
          title="Ringkasan bahan belum lengkap"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Muat ulang
            </Button>
          }
        >
          Resep sebagian menu belum bisa dimuat, jadi kolom bahan di bawah ada yang kosong.
        </InlineAlert>
      ) : null}

      <section className="ds-card ds-card-clip">
        <div className="ds-toolbar">
          <FilterChips
            label="Filter status"
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            items={[
              { id: "all", label: "Semua", count: known ? counts.all : undefined },
              { id: "active", label: "Aktif", count: known ? counts.active : undefined },
              { id: "inactive", label: "Nonaktif", count: known ? counts.inactive : undefined },
            ]}
          />
          <div className="ds-toolbar-group">
            <label className="ds-search">
              <span className="ds-sr-only">Cari menu</span>
              <input
                type="search"
                placeholder="Cari menu atau bahan"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <p className="ds-card-hint">
              {canWrite ? "Klik baris untuk mengubah resep" : "Klik baris untuk melihat resep"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="ds-empty">
            <p className="ds-empty-text">Memuat resep…</p>
          </div>
        ) : loadError && menus.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">Daftar belum tersedia</p>
            <p className="ds-empty-text">Gunakan “Coba lagi” di atas setelah koneksi pulih.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">
              {menus.length === 0 ? "Belum ada menu" : "Tidak ada yang cocok"}
            </p>
            <p className="ds-empty-text">
              {menus.length === 0
                ? canWrite
                  ? "Tambahkan menu pertama beserta bahan per paketnya. Menu dipakai di Akhir shift dan Ajukan permintaan."
                  : "Belum ada menu yang dibuat."
                : "Ubah filter atau kata kunci pencarian."}
            </p>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table is-cozy is-stack">
              <thead>
                <tr>
                  <th>Menu</th>
                  <th>Bahan per paket</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => {
                  const lines = recipes[m.id];
                  return (
                    <tr
                      key={m.id}
                      className={`is-clickable${m.is_active ? "" : " is-inactive"}`}
                      onClick={() => void openMenu(m)}
                    >
                      <td data-title>
                        <div className="ds-cell-stack">
                          <button
                            type="button"
                            className="ds-row-btn"
                            aria-label={`${canWrite ? "Ubah" : "Lihat"} resep ${m.name}`}
                          >
                            {m.name}
                          </button>
                          <span className="ds-cell-sub">
                            {lines ? `${lines.length} bahan per paket` : "—"}
                          </span>
                        </div>
                      </td>
                      <td data-label="Bahan per paket" data-block className="ds-recipe-summary">
                        {lines && lines.length === 0 ? (
                          // ExpandMenus (Akhir shift and Ajukan permintaan) rejects a menu with no lines.
                          <>
                            <span className="ds-tone-warn">Belum ada bahan.</span> Belum bisa dipakai di
                            Akhir shift dan Ajukan permintaan.
                          </>
                        ) : (
                          summary(m)
                        )}
                      </td>
                      <td data-label="Status" className="ds-text-sm">
                        {m.is_active ? (
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
        title={drawer === "edit" ? "Edit menu / resep" : "Tambah menu"}
        description="Nama menu dan bahan yang terpakai untuk satu paket."
        onClose={closeDrawer}
        onSubmit={() => void save()}
        submitLabel={drawer === "edit" ? "Simpan perubahan" : "Simpan menu"}
        saving={saving}
        canSubmit={reason === null}
        reason={reason}
        error={saveError}
      >
        <label className="ds-field">
          Nama menu
          <input
            className="ds-input"
            type="text"
            value={name}
            autoFocus={drawer === "create"}
            aria-invalid={sameName ? true : undefined}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="ds-recipe" role="group" aria-labelledby="recipe-title">
          <p id="recipe-title" className="ds-recipe-title">
            Bahan per paket
          </p>
          <div className="ds-recipe-head" aria-hidden="true">
            <span>Bahan</span>
            <span>Qty per paket</span>
            <span />
          </div>
          {rows.map((row, i) => {
            const it = itemById.get(row.item_id);
            const unit = it ? (unitCode.get(it.unit_id) ?? "") : "";
            const qtyBad = row.qty !== "" && !(Number(row.qty) > 0);
            return (
              <div key={row.key} className="ds-recipe-row">
                <select
                  className="ds-select"
                  aria-label={`Bahan ${i + 1}`}
                  value={row.item_id}
                  onChange={(e) => updateRow(row.key, { item_id: e.target.value })}
                >
                  <option value="">Pilih bahan…</option>
                  {sortedItems
                    .filter((o) => o.is_active || o.id === row.item_id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {o.is_active ? "" : " (nonaktif)"}
                      </option>
                    ))}
                </select>
                <UnitInput
                  unit={unit}
                  min={0}
                  step="any"
                  value={row.qty}
                  invalid={qtyBad}
                  aria-label={`Qty per paket bahan ${i + 1}`}
                  onChange={(e) => updateRow(row.key, { qty: e.target.value })}
                />
                <button
                  type="button"
                  className="ds-icon-btn"
                  aria-label={`Hapus bahan ${i + 1}`}
                  onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                >
                  <IconClose size={18} />
                </button>
              </div>
            );
          })}
          <button type="button" className="ds-add-row" onClick={addRow}>
            + Tambah bahan
          </button>
        </div>

        {drawer === "edit" && editing ? (
          <StatusToggle
            key={editing.id}
            active={editing.is_active}
            noun="menu"
            busy={saving}
            consequence="Menu tidak muncul lagi di Akhir shift dan Ajukan permintaan baru. Dokumen lama tetap ada."
            onConfirm={() => void setActive(!editing.is_active)}
          />
        ) : null}
      </EntityDrawer>

      <Drawer
        open={viewing !== null}
        title={viewing?.name ?? "Resep"}
        description="Bahan yang terpakai untuk satu paket."
        onClose={() => setViewing(null)}
      >
        {viewingLines.length === 0 ? (
          <p className="ds-empty-text">Belum ada bahan.</p>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table is-tight">
              <thead>
                <tr>
                  <th>Bahan</th>
                  <th className="is-num">Qty per paket</th>
                </tr>
              </thead>
              <tbody>
                {viewingLines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="ds-cell-stack">
                        <span className="ds-cell-name">{l.item_name ?? "—"}</span>
                        <span className="ds-cell-sub ds-num">{l.item_sku ?? ""}</span>
                      </div>
                    </td>
                    <td className="is-num">
                      <Qty value={l.qty_per_paket} unit={l.unit_code} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Drawer>
    </div>
  );
}
