"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { getUser } from "@/lib/auth";
import {
  AdminUser,
  adminApi,
  canManageUsers,
  ROLE_OPTIONS,
} from "@/lib/admin";
import { roleLabel } from "@/lib/rbac";
import { toastError, toastSuccess } from "@/lib/toast";

type DrawerMode = "create" | "edit" | "password" | null;

export default function AdminUsersPage() {
  const [meId, setMeId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(ROLE_OPTIONS[1].value);
  const [password, setPassword] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((u) => {
      const label = roleLabel(u.role).toLowerCase();
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        label.includes(q)
      );
    });
  }, [rows, query]);

  const load = useCallback(async () => {
    try {
      setRows(await adminApi.listUsers());
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat pengguna");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    const allowed = user ? canManageUsers(user.role) : false;
    setCanManage(allowed);
    setMeId(user?.id ?? null);
    if (allowed) {
      void load();
    } else {
      setLoading(false);
    }
  }, [load]);

  function closeDrawer() {
    setDrawer(null);
    setSelected(null);
    setFormError(null);
    setFullName("");
    setEmail("");
    setRole(ROLE_OPTIONS[1].value);
    setPassword("");
  }

  function openCreate() {
    setSelected(null);
    setFullName("");
    setEmail("");
    setRole(ROLE_OPTIONS[1].value);
    setPassword("");
    setFormError(null);
    setDrawer("create");
  }

  function openEdit(u: AdminUser) {
    setSelected(u);
    setFullName(u.full_name);
    setRole(u.role);
    setPassword("");
    setFormError(null);
    setDrawer("edit");
  }

  function openPassword(u: AdminUser) {
    setSelected(u);
    setPassword("");
    setFormError(null);
    setDrawer("password");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setFormError(null);
    try {
      if (drawer === "create") {
        await adminApi.createUser({
          email,
          full_name: fullName,
          password,
          role,
        });
        toastSuccess("Pengguna ditambahkan");
      } else if (drawer === "edit" && selected) {
        await adminApi.patchUser(selected.id, {
          full_name: fullName,
          role,
        });
        toastSuccess("Pengguna diperbarui");
      } else if (drawer === "password" && selected) {
        await adminApi.resetPassword(selected.id, password);
        toastSuccess("Kata sandi diatur ulang");
      }
      closeDrawer();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Aksi gagal");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: AdminUser) {
    if (!canManage || u.id === meId) return;
    const next = !u.is_active;
    const ok = window.confirm(
      next
        ? `Aktifkan ${u.full_name}?`
        : `Nonaktifkan ${u.full_name}? Akun tidak bisa masuk.`,
    );
    if (!ok) return;
    try {
      await adminApi.patchUser(u.id, { is_active: next });
      toastSuccess(next ? "Pengguna diaktifkan" : "Pengguna dinonaktifkan");
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal mengubah status");
    }
  }

  if (!canManage) {
    return (
      <div className="si-page">
        <header className="si-page-header">
          <div className="page-header-text">
            <p className="section-label">Administrasi</p>
            <h1 className="page-title">Pengguna</h1>
            <p className="lede">Akses ditolak untuk peran ini.</p>
          </div>
          <div className="page-header-actions">
            <Link className="btn btn-ghost" href="/app">
              Kembali
            </Link>
          </div>
        </header>
      </div>
    );
  }

  const drawerTitle =
    drawer === "create"
      ? "Tambah pengguna"
      : drawer === "edit"
        ? "Edit pengguna"
        : drawer === "password"
          ? "Reset kata sandi"
          : "";

  const drawerDesc =
    drawer === "create"
      ? "Akun login dan peran."
      : drawer === "edit"
        ? "Nama dan peran. Email tidak diubah."
        : drawer === "password"
          ? `Sandi baru untuk ${selected?.full_name ?? "pengguna"}.`
          : undefined;

  return (
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Administrasi</p>
          <h1 className="page-title">Pengguna</h1>
          <p className="lede">Akun login dan peran.</p>
        </div>
      </header>

      <div className="si-toolbar">
        <div className="si-toolbar-meta">
          <p className="si-count">
            <strong>{filtered.length}</strong> dari {rows.length} data
          </p>
          <input
            className="input si-search"
            type="search"
            placeholder="Cari nama, email, atau peran…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari pengguna"
          />
        </div>
        <div className="si-toolbar-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void load()}
          >
            Muat ulang
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Tambah pengguna
          </button>
        </div>
      </div>

      <section className="si-table-card">
        {loading ? (
          <div className="si-empty">
            <p className="muted">Memuat data…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="si-empty">
            <p className="si-empty-title">
              {rows.length === 0 ? "Belum ada pengguna" : "Tidak ada hasil"}
            </p>
            <p className="si-empty-desc">
              {rows.length === 0
                ? "Belum ada data."
                : "Tidak cocok dengan pencarian."}
            </p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.id === meId;
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.full_name}</strong>
                        {isSelf ? (
                          <span className="muted"> · Anda</span>
                        ) : null}
                      </td>
                      <td>{u.email}</td>
                      <td>{roleLabel(u.role)}</td>
                      <td>{u.is_active ? "Aktif" : "Nonaktif"}</td>
                      <td>
                        <div className="si-toolbar-actions" style={{ gap: "0.35rem" }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => openEdit(u)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => openPassword(u)}
                          >
                            Reset sandi
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={isSelf}
                            title={
                              isSelf
                                ? "Tidak bisa menonaktifkan akun sendiri"
                                : undefined
                            }
                            onClick={() => void toggleActive(u)}
                          >
                            {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer
        open={drawer !== null}
        title={drawerTitle}
        description={drawerDesc}
        onClose={closeDrawer}
      >
        {formError ? <p className="error">{formError}</p> : null}
        <form className="form" onSubmit={(e) => void onSubmit(e)}>
          {drawer === "create" || drawer === "edit" ? (
            <>
              <div className="field">
                <label className="label" htmlFor="user-fullname">
                  Nama lengkap
                </label>
                <input
                  id="user-fullname"
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {drawer === "create" ? (
                <div className="field">
                  <label className="label" htmlFor="user-email">
                    Email
                  </label>
                  <input
                    id="user-email"
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
              ) : null}
              <div className="field">
                <label className="label" htmlFor="user-role">
                  Peran
                </label>
                <select
                  id="user-role"
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {drawer === "create" ? (
                <div className="field">
                  <label className="label" htmlFor="user-password">
                    Kata sandi
                  </label>
                  <input
                    id="user-password"
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              ) : null}
            </>
          ) : null}

          {drawer === "password" ? (
            <div className="field">
              <label className="label" htmlFor="user-new-password">
                Kata sandi baru
              </label>
              <input
                id="user-new-password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
                autoComplete="new-password"
              />
            </div>
          ) : null}

          <div className="drawer-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeDrawer}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
