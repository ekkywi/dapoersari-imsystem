"use client";

import { useCallback, useEffect, useState } from "react";
import { EntityDrawer } from "@/components/features/EntityDrawer";
import { RoleRadioGroup } from "@/components/features/RoleRadioGroup";
import { StatusToggle } from "@/components/features/StatusToggle";
import { Button, LinkButton } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { PasswordField } from "@/components/ui/PasswordField";
import {
  type AdminUser,
  adminApi,
  canManageUsers,
  initials,
  isEndpointMissing,
  MIN_PASSWORD,
  ROLE_OPTIONS,
} from "@/lib/admin";
import { type AuthUser, getUser } from "@/lib/auth";
import { Role, roleLabel } from "@/lib/rbac";
import { toastSuccess } from "@/lib/toast";

/** The API refuses two things with the same bare 403; say which ones. */
function explainUserError(message: string): string {
  if (message.includes("aksi tidak diizinkan")) {
    return "Aksi ini ditolak. Anda tidak bisa menonaktifkan akun sendiri, dan harus selalu ada satu Super Admin yang aktif.";
  }
  if (message.includes("email sudah terpakai")) return "Email ini sudah dipakai akun lain.";
  if (message.includes("input tidak valid") || message.includes("data tidak valid")) {
    return "Server menolak isiannya. Periksa nama, email, dan panjang kata sandi (minimal 8 karakter).";
  }
  return message;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function UserPanel({
  user,
  isSelf,
  onUpdated,
}: {
  user: AdminUser;
  isSelf: boolean;
  onUpdated: (u: AdminUser) => void;
}) {
  const [name, setName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const changed = name.trim() !== user.full_name || role !== user.role;
  const saveReason = name.trim() === "" ? "Nama tidak boleh kosong." : !changed ? "Belum ada perubahan." : null;
  const selfDemote = isSelf && user.role === Role.SuperAdmin && role !== Role.SuperAdmin;
  const missing = Math.max(0, MIN_PASSWORD - password.length);

  async function save() {
    if (saveReason !== null) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await adminApi.patchUser(user.id, { full_name: name.trim(), role });
      toastSuccess("Perubahan disimpan");
      onUpdated(updated);
    } catch (e) {
      setError(explainUserError(e instanceof Error ? e.message : "Gagal menyimpan"));
    } finally {
      setSaving(false);
    }
  }

  async function setActive(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      const updated = await adminApi.patchUser(user.id, { is_active: next });
      toastSuccess(next ? `${user.full_name} diaktifkan` : `${user.full_name} dinonaktifkan`);
      onUpdated(updated);
    } catch (e) {
      setError(explainUserError(e instanceof Error ? e.message : "Gagal mengubah status"));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (missing > 0) return;
    setResetting(true);
    setResetError(null);
    try {
      await adminApi.resetPassword(user.id, password);
      toastSuccess(`Kata sandi ${user.full_name} diatur ulang`);
      setPassword("");
    } catch (e) {
      setResetError(explainUserError(e instanceof Error ? e.message : "Gagal mengatur ulang"));
    } finally {
      setResetting(false);
    }
  }

  return (
    <aside className="ds-card ds-user-panel" aria-labelledby="edit-title">
      <div className="ds-user-panel-head">
        <h2 id="edit-title" className="ds-card-title">
          {user.full_name}
        </h2>
        <p className="ds-num ds-card-hint">{user.email}</p>
      </div>

      <form
        className="ds-user-panel-body"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {error ? (
          <InlineAlert role="alert" title="Belum berhasil">
            {error}
          </InlineAlert>
        ) : null}

        <label className="ds-field ds-field-sm">
          Nama lengkap
          <input
            className="ds-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <RoleRadioGroup name="role" value={role} onChange={setRole} />

        {selfDemote ? (
          <InlineAlert tone="warn" title="Anda akan kehilangan akses ke halaman ini">
            Peran Anda sendiri diturunkan dari Super Admin. Setelah disimpan, menu Pengguna tidak
            terbuka lagi untuk Anda.
          </InlineAlert>
        ) : null}

        {isSelf ? (
          <div className="ds-status-box">
            <div className="ds-status-row">
              <span>
                Status akun: <strong className="ds-status-active">Aktif</strong>
              </span>
            </div>
            <p className="ds-card-hint">Akun sendiri tidak bisa dinonaktifkan.</p>
          </div>
        ) : (
          <StatusToggle
            key={`${user.id}-${user.is_active}`}
            active={user.is_active}
            noun="akun"
            busy={saving}
            consequence="Akun ini tidak bisa masuk lagi. Riwayat stok yang merujuk ke akun ini tetap ada."
            onConfirm={() => void setActive(!user.is_active)}
          />
        )}

        <div className="ds-user-save">
          {saveReason ? (
            <p id="user-save-reason" className="ds-reason">
              {saveReason}
            </p>
          ) : null}
          <Button
            type="submit"
            block
            disabled={saveReason !== null || saving}
            aria-describedby={saveReason ? "user-save-reason" : undefined}
          >
            {saving ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
        </div>
      </form>

      <div className="ds-user-reset">
        <h3 className="ds-side-title">Atur ulang kata sandi</h3>
        <p className="ds-card-hint">
          Pengguna lupa sandi? Buat sandi baru lalu sampaikan langsung ke orangnya.
        </p>
        {resetError ? (
          <InlineAlert role="alert" title="Kata sandi belum diatur ulang">
            {resetError}
          </InlineAlert>
        ) : null}
        <form
          className="ds-user-reset-row"
          onSubmit={(e) => {
            e.preventDefault();
            void reset();
          }}
        >
          <label className="ds-field ds-field-sm ds-grow">
            <span className="ds-field-hint">Sandi baru, minimal {MIN_PASSWORD} karakter</span>
            <PasswordField
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              invalid={password.length > 0 && missing > 0}
            />
          </label>
          <Button
            type="submit"
            variant="secondary"
            disabled={missing > 0 || resetting}
            aria-describedby={password.length > 0 && missing > 0 ? "reset-reason" : undefined}
          >
            {resetting ? "Memproses…" : "Atur ulang"}
          </Button>
        </form>
        {password.length > 0 && missing > 0 ? (
          <p id="reset-reason" className="ds-reason is-left">
            Kurang {missing} karakter lagi.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

export default function AdminUsersPage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ missing: boolean; message: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(ROLE_OPTIONS[1].value);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setRows(await adminApi.listUsers());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal memuat pengguna";
      setLoadError({ missing: isEndpointMissing(message), message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setMe(user);
    setChecked(true);
    if (user && canManageUsers(user.role)) void load();
    else setLoading(false);
  }, [load]);

  function openCreate() {
    setFullName("");
    setEmail("");
    setRole(ROLE_OPTIONS[1].value);
    setPassword("");
    setSaveError(null);
    setCreating(true);
  }

  const emailNorm = email.trim().toLowerCase();
  const taken = rows.find((u) => u.email.toLowerCase() === emailNorm);
  const createReason =
    fullName.trim() === ""
      ? "Nama lengkap wajib diisi."
      : !EMAIL_RE.test(emailNorm)
        ? "Isi email yang valid."
        : taken
          ? `Email ini sudah dipakai ${taken.full_name}.`
          : password.length < MIN_PASSWORD
            ? `Kata sandi minimal ${MIN_PASSWORD} karakter (kurang ${MIN_PASSWORD - password.length}).`
            : null;

  async function create() {
    if (createReason !== null) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await adminApi.createUser({
        email: emailNorm,
        full_name: fullName.trim(),
        password,
        role,
      });
      toastSuccess(`${created.full_name} ditambahkan`);
      setCreating(false);
      await load();
      setSelectedId(created.id);
    } catch (e) {
      setSaveError(explainUserError(e instanceof Error ? e.message : "Gagal menambahkan"));
    } finally {
      setSaving(false);
    }
  }

  function applyUpdated(u: AdminUser) {
    setRows((prev) => prev.map((x) => (x.id === u.id ? u : x)));
  }

  if (!checked) {
    return (
      <div className="ds-screen">
        <p className="ds-card-hint">Memuat…</p>
      </div>
    );
  }

  if (!me || !canManageUsers(me.role)) {
    return (
      <div className="ds-screen">
        <InlineAlert
          tone="info"
          title="Hanya Super Admin yang bisa mengelola pengguna"
          actions={
            <LinkButton size="sm" variant="secondary" href="/app">
              Ke ringkasan
            </LinkButton>
          }
        >
          Peran Anda tidak punya akses ke halaman ini.
        </InlineAlert>
      </div>
    );
  }

  const selected = rows.find((u) => u.id === selectedId) ?? null;

  return (
    <div className="ds-screen">
      <PageHeader
        title="Pengguna"
        lede="Siapa yang bisa masuk dan apa yang boleh mereka lakukan. Akun tidak dihapus, cukup dinonaktifkan, karena riwayat stok merujuk ke akun ini."
        actions={
          loadError?.missing ? undefined : <Button onClick={openCreate}>Tambah pengguna</Button>
        }
      />

      {loadError ? (
        loadError.missing ? (
          <InlineAlert
            tone="warn"
            title="Fitur pengguna belum aktif di server."
            actions={
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Coba lagi
              </Button>
            }
          >
            Server tidak mengenali rute pengguna. Minta pemilik backend mengaktifkannya, lalu muat
            ulang halaman ini.
          </InlineAlert>
        ) : (
          <InlineAlert
            role="alert"
            title="Daftar pengguna belum bisa dimuat"
            actions={
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Coba lagi
              </Button>
            }
          >
            {loadError.message}. Periksa koneksi Anda, lalu coba lagi.
          </InlineAlert>
        )
      ) : null}

      {loadError ? null : (
        <div className="ds-split">
          <section className="ds-card ds-card-clip ds-split-main" aria-label="Daftar pengguna">
            <div className="ds-user-row is-head" aria-hidden="true">
              <span>Nama</span>
              <span>Peran</span>
              <span>Status</span>
            </div>
            {loading ? (
              <p className="ds-todo-empty">Memuat pengguna…</p>
            ) : rows.length === 0 ? (
              <div className="ds-empty">
                <p className="ds-empty-title">Belum ada pengguna</p>
                <p className="ds-empty-text">Tambahkan akun pertama untuk staf gudang atau dapur.</p>
              </div>
            ) : (
              <ul className="ds-user-list">
                {rows.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="ds-user-row"
                      aria-pressed={u.id === selectedId}
                      onClick={() => setSelectedId(u.id)}
                    >
                      <span className="ds-user-who">
                        <span className="ds-avatar" aria-hidden="true">
                          {initials(u.full_name, u.email)}
                        </span>
                        <span className="ds-cell-stack">
                          <span className="ds-user-name">
                            {u.full_name}
                            {u.id === me.id ? (
                              <>
                                {" "}
                                <span className="ds-self-tag">Anda</span>
                              </>
                            ) : null}
                          </span>
                          <span className="ds-num ds-user-email">{u.email}</span>
                          <span className="ds-user-role-sm">{roleLabel(u.role)}</span>
                        </span>
                      </span>
                      <span className="ds-user-role">{roleLabel(u.role)}</span>
                      <span className={u.is_active ? "ds-user-active" : "ds-user-inactive"}>
                        {u.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selected ? (
            <UserPanel
              key={`${selected.id}:${selected.full_name}:${selected.role}:${selected.is_active}`}
              user={selected}
              isSelf={selected.id === me.id}
              onUpdated={applyUpdated}
            />
          ) : (
            <aside className="ds-card ds-user-panel is-empty" aria-label="Detail pengguna">
              <p className="ds-card-hint">
                Pilih pengguna di daftar untuk mengubah nama, peran, status, atau mengatur ulang
                kata sandinya.
              </p>
            </aside>
          )}
        </div>
      )}

      <EntityDrawer
        open={creating}
        title="Tambah pengguna"
        description="Akun login dan peran. Sampaikan kata sandinya langsung ke orangnya."
        onClose={() => setCreating(false)}
        onSubmit={() => void create()}
        submitLabel="Simpan pengguna"
        saving={saving}
        canSubmit={createReason === null}
        reason={createReason}
        error={saveError}
      >
        <label className="ds-field ds-field-sm">
          Nama lengkap
          <input
            className="ds-input"
            type="text"
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>
        <label className="ds-field ds-field-sm">
          Email
          <input
            className="ds-input ds-num"
            type="email"
            autoComplete="off"
            placeholder="nama@dapoersari.local"
            aria-invalid={taken ? true : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {taken ? (
            <span className="ds-field-hint ds-note-danger">Sudah dipakai {taken.full_name}.</span>
          ) : null}
        </label>
        <RoleRadioGroup name="new-role" value={role} onChange={setRole} />
        <label className="ds-field ds-field-sm">
          Kata sandi <span className="ds-field-hint">Minimal {MIN_PASSWORD} karakter</span>
          <PasswordField autoComplete="new-password" value={password} onChange={setPassword} />
        </label>
      </EntityDrawer>
    </div>
  );
}
