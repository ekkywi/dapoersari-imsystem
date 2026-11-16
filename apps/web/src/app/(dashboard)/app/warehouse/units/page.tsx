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
import { type Item, type Unit, warehouseApi } from "@/lib/warehouse";

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [drawer, setDrawer] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [unitRows, itemRows] = await Promise.all([
        warehouseApi.listUnits(),
        warehouseApi.listItems(),
      ]);
      setUnits(unitRows);
      setItems(itemRows);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat satuan");
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
    for (const it of items) m.set(it.unit_id, (m.get(it.unit_id) ?? 0) + 1);
    return m;
  }, [items]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...units]
      .sort((a, b) => a.code.localeCompare(b.code, "id"))
      .filter((u) => !q || u.code.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
  }, [units, query]);

  function openCreate() {
    setEditing(null);
    setCode("");
    setName("");
    setSaveError(null);
    setDrawer("create");
  }

  function openEdit(u: Unit) {
    if (!canWrite) return;
    setEditing(u);
    setCode(u.code);
    setName(u.name);
    setSaveError(null);
    setDrawer("edit");
  }

  function closeDrawer() {
    setDrawer(null);
    setEditing(null);
    setSaveError(null);
  }

  const codeNorm = code.trim();
  const taken = units.find((u) => u.code.toLowerCase() === codeNorm.toLowerCase() && u.id !== editing?.id);
  const reason =
    codeNorm === ""
      ? "Kode satuan wajib diisi."
      : taken
        ? `Kode ${codeNorm} sudah dipakai satuan ${taken.name}.`
        : name.trim() === ""
          ? "Nama satuan wajib diisi."
          : null;

  async function save() {
    if (reason !== null) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (drawer === "create") {
        await warehouseApi.createUnit({ code: codeNorm, name: name.trim() });
        toastSuccess(`Satuan ${codeNorm} ditambahkan`);
      } else if (editing) {
        await warehouseApi.patchUnit(editing.id, { code: codeNorm, name: name.trim() });
        toastSuccess("Satuan diperbarui");
      }
      closeDrawer();
      await load();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setSaveError(explainMasterError(e instanceof Error ? e.message : "Gagal menyimpan", "kode"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ds-screen">
      <MasterHeader
        active="units"
        refreshKey={refreshKey}
        action={canWrite ? { label: "Tambah satuan", onClick: openCreate } : undefined}
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Daftar satuan belum bisa dimuat"
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
            <span className="ds-sr-only">Cari satuan</span>
            <input
              type="search"
              placeholder="Cari kode atau nama"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {canWrite ? <p className="ds-card-hint">Klik baris untuk mengubah</p> : null}
        </div>

        {loading ? (
          <div className="ds-empty">
            <p className="ds-empty-text">Memuat satuan…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">{units.length === 0 ? "Belum ada satuan" : "Tidak ada yang cocok"}</p>
            <p className="ds-empty-text">
              {units.length === 0
                ? "Satuan dibutuhkan sebelum item bisa dibuat, misalnya kg, l, atau btr."
                : "Coba kode atau nama yang lain."}
            </p>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table is-tight">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th className="is-num">Dipakai item</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className={canWrite ? "is-clickable" : undefined}
                    onClick={canWrite ? () => openEdit(u) : undefined}
                  >
                    <td className="ds-num">
                      {canWrite ? (
                        <button type="button" className="ds-row-btn ds-num" aria-label={`Ubah satuan ${u.code}`}>
                          {u.code}
                        </button>
                      ) : (
                        <strong>{u.code}</strong>
                      )}
                    </td>
                    <td>{u.name}</td>
                    <td className="is-num ds-num">{usage.get(u.id) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EntityDrawer
        open={drawer !== null}
        title={drawer === "edit" ? "Edit satuan" : "Tambah satuan"}
        description="Kode tampil di samping setiap angka persediaan."
        onClose={closeDrawer}
        onSubmit={() => void save()}
        submitLabel={drawer === "edit" ? "Simpan perubahan" : "Simpan satuan"}
        saving={saving}
        canSubmit={reason === null}
        reason={reason}
        error={saveError}
      >
        <label className="ds-field ds-field-sm">
          Kode
          <input
            className="ds-input ds-num"
            type="text"
            value={code}
            autoFocus
            aria-invalid={taken ? true : undefined}
            onChange={(e) => setCode(e.target.value)}
          />
          <span className={taken ? "ds-field-hint ds-note-danger" : "ds-field-hint"}>
            {taken ? `Sudah dipakai satuan ${taken.name}.` : "Singkatan pendek, misalnya kg, l, btr."}
          </span>
        </label>
        <label className="ds-field ds-field-sm">
          Nama
          <input
            className="ds-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </EntityDrawer>
    </div>
  );
}
