"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EntityDrawer } from "@/components/features/EntityDrawer";
import { MasterHeader } from "@/components/features/MasterHeader";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { getUser } from "@/lib/auth";
import { explainMasterError } from "@/lib/master";
import { canMutateWarehouse } from "@/lib/rbac";
import { toastSuccess } from "@/lib/toast";
import { type Category, type Item, warehouseApi } from "@/lib/warehouse";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [drawer, setDrawer] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [catRows, itemRows] = await Promise.all([
        warehouseApi.listCategories(),
        warehouseApi.listItems(),
      ]);
      setCategories(catRows);
      setItems(itemRows);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat kategori");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setCanWrite(user ? canMutateWarehouse(user.role) : false);
    void load();
  }, [load]);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      if (it.category_id) m.set(it.category_id, (m.get(it.category_id) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...categories]
      .sort((a, b) => a.name.localeCompare(b.name, "id"))
      .filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [categories, query]);

  function openCreate() {
    setEditing(null);
    setName("");
    setSaveError(null);
    setDrawer("create");
  }

  function openEdit(c: Category) {
    if (!canWrite) return;
    setEditing(c);
    setName(c.name);
    setSaveError(null);
    setDrawer("edit");
  }

  function closeDrawer() {
    setDrawer(null);
    setEditing(null);
    setSaveError(null);
  }

  const nameNorm = name.trim();
  const taken = categories.find((c) => c.name.toLowerCase() === nameNorm.toLowerCase() && c.id !== editing?.id);
  const reason =
    nameNorm === "" ? "Nama kategori wajib diisi." : taken ? `Kategori ${taken.name} sudah ada.` : null;

  async function save() {
    if (reason !== null) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (drawer === "create") {
        await warehouseApi.createCategory({ name: nameNorm });
        toastSuccess(`Kategori ${nameNorm} ditambahkan`);
      } else if (editing) {
        await warehouseApi.patchCategory(editing.id, { name: nameNorm });
        toastSuccess("Kategori diperbarui");
      }
      closeDrawer();
      await load();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setSaveError(explainMasterError(e instanceof Error ? e.message : "Gagal menyimpan", "nama"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ds-screen">
      <MasterHeader
        active="categories"
        refreshKey={refreshKey}
        action={canWrite ? { label: "Tambah kategori", onClick: openCreate } : undefined}
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Daftar kategori belum bisa dimuat"
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
            <span className="ds-sr-only">Cari kategori</span>
            <input
              type="search"
              placeholder="Cari nama kategori"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {canWrite ? <p className="ds-card-hint">Klik baris untuk mengubah</p> : null}
        </div>

        {loading ? (
          <div className="ds-empty">
            <p className="ds-empty-text">Memuat kategori…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">
              {categories.length === 0 ? "Belum ada kategori" : "Tidak ada yang cocok"}
            </p>
            <p className="ds-empty-text">
              {categories.length === 0
                ? "Kategori mengelompokkan item, misalnya Protein atau Bumbu. Boleh dikosongkan."
                : "Coba nama yang lain."}
            </p>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table is-tight">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th className="is-num">Jumlah item</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className={canWrite ? "is-clickable" : undefined}
                    onClick={canWrite ? () => openEdit(c) : undefined}
                  >
                    <td>
                      {canWrite ? (
                        <button type="button" className="ds-row-btn" aria-label={`Ubah kategori ${c.name}`}>
                          {c.name}
                        </button>
                      ) : (
                        <strong>{c.name}</strong>
                      )}
                    </td>
                    <td className="is-num ds-num">{usage.get(c.id) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EntityDrawer
        open={drawer !== null}
        title={drawer === "edit" ? "Edit kategori" : "Tambah kategori"}
        description="Mengelompokkan item di daftar dan lembar opname."
        onClose={closeDrawer}
        onSubmit={() => void save()}
        submitLabel={drawer === "edit" ? "Simpan perubahan" : "Simpan kategori"}
        saving={saving}
        canSubmit={reason === null}
        reason={reason}
        error={saveError}
      >
        <label className="ds-field ds-field-sm">
          Nama kategori
          <input
            className="ds-input"
            type="text"
            value={name}
            autoFocus
            aria-invalid={taken ? true : undefined}
            onChange={(e) => setName(e.target.value)}
          />
          {taken ? (
            <span className="ds-field-hint ds-note-danger">Kategori ini sudah ada.</span>
          ) : null}
        </label>
      </EntityDrawer>
    </div>
  );
}
