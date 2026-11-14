"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EntityDrawer } from "@/components/features/EntityDrawer";
import { MasterHeader } from "@/components/features/MasterHeader";
import { StatusToggle } from "@/components/features/StatusToggle";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { getUser } from "@/lib/auth";
import { explainMasterError } from "@/lib/master";
import { canMutateWarehouse } from "@/lib/rbac";
import { toastSuccess } from "@/lib/toast";
import { type Supplier, warehouseApi } from "@/lib/warehouse";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [drawer, setDrawer] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setSuppliers(await warehouseApi.listSuppliers());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat pemasok");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setCanWrite(user ? canMutateWarehouse(user.role) : false);
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...suppliers]
      .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, "id"))
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          (s.phone ?? "").toLowerCase().includes(q) ||
          (s.note ?? "").toLowerCase().includes(q),
      );
  }, [suppliers, query]);

  function openCreate() {
    setEditing(null);
    setName("");
    setPhone("");
    setNote("");
    setSaveError(null);
    setDrawer("create");
  }

  function openEdit(s: Supplier) {
    if (!canWrite) return;
    setEditing(s);
    setName(s.name);
    setPhone(s.phone ?? "");
    setNote(s.note ?? "");
    setSaveError(null);
    setDrawer("edit");
  }

  function closeDrawer() {
    setDrawer(null);
    setEditing(null);
    setSaveError(null);
  }

  const reason = name.trim() === "" ? "Nama pemasok wajib diisi." : null;

  async function save() {
    if (reason !== null) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body = {
        name: name.trim(),
        phone: phone.trim() || null,
        note: note.trim() || null,
      };
      if (drawer === "create") {
        await warehouseApi.createSupplier(body);
        toastSuccess(`${body.name} ditambahkan`);
      } else if (editing) {
        await warehouseApi.patchSupplier(editing.id, body);
        toastSuccess("Pemasok diperbarui");
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

  async function setActive(next: boolean) {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      await warehouseApi.patchSupplier(editing.id, { is_active: next });
      toastSuccess(next ? "Pemasok diaktifkan" : "Pemasok dinonaktifkan");
      closeDrawer();
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Gagal mengubah status");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ds-screen">
      <MasterHeader
        active="suppliers"
        refreshKey={refreshKey}
        action={canWrite ? { label: "Tambah pemasok", onClick: openCreate } : undefined}
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Daftar pemasok belum bisa dimuat"
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
            <span className="ds-sr-only">Cari pemasok</span>
            <input
              type="search"
              placeholder="Cari nama, telepon, catatan"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {canWrite ? <p className="ds-card-hint">Klik baris untuk mengubah</p> : null}
        </div>

        {loading ? (
          <div className="ds-empty">
            <p className="ds-empty-text">Memuat pemasok…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">
              {suppliers.length === 0 ? "Belum ada pemasok" : "Tidak ada yang cocok"}
            </p>
            <p className="ds-empty-text">
              {suppliers.length === 0
                ? "Pemasok dipilih saat mencatat persediaan masuk. Boleh dikosongkan."
                : "Coba nama, telepon, atau catatan yang lain."}
            </p>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table is-tight">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Telepon</th>
                  <th>Catatan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr
                    key={s.id}
                    className={`${canWrite ? "is-clickable" : ""}${s.is_active ? "" : " is-inactive"}`.trim() || undefined}
                    onClick={canWrite ? () => openEdit(s) : undefined}
                  >
                    <td>
                      {canWrite ? (
                        <button type="button" className="ds-row-btn" aria-label={`Ubah pemasok ${s.name}`}>
                          {s.name}
                        </button>
                      ) : (
                        <strong>{s.name}</strong>
                      )}
                    </td>
                    <td className="ds-num">{s.phone || "—"}</td>
                    <td className="ds-ink-2">{s.note || "—"}</td>
                    <td className="ds-text-sm">
                      {s.is_active ? <span className="ds-status-active">Aktif</span> : <span>Nonaktif</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EntityDrawer
        open={drawer !== null}
        title={drawer === "edit" ? "Edit pemasok" : "Tambah pemasok"}
        description="Nama dan kontak. Dipilih saat mencatat persediaan masuk."
        onClose={closeDrawer}
        onSubmit={() => void save()}
        submitLabel={drawer === "edit" ? "Simpan perubahan" : "Simpan pemasok"}
        saving={saving}
        canSubmit={reason === null}
        reason={reason}
        error={saveError}
      >
        <label className="ds-field ds-field-sm">
          Nama pemasok
          <input
            className="ds-input"
            type="text"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="ds-field ds-field-sm">
          Telepon <span className="ds-field-hint">Opsional</span>
          <input
            className="ds-input ds-num"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="ds-field ds-field-sm">
          Catatan <span className="ds-field-hint">Opsional, misalnya hari kirim</span>
          <input
            className="ds-input"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {drawer === "edit" && editing ? (
          <StatusToggle
            key={editing.id}
            active={editing.is_active}
            noun="pemasok"
            busy={saving}
            consequence="Pemasok tidak muncul lagi di pilihan persediaan masuk. Dokumen lama tetap mencatat namanya."
            onConfirm={() => void setActive(!editing.is_active)}
          />
        ) : null}
      </EntityDrawer>
    </div>
  );
}
