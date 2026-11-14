import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { Role } from "@/lib/rbac";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

export type CreateAdminUserBody = {
  email: string;
  full_name: string;
  password: string;
  role: string;
};

export type PatchAdminUserBody = {
  full_name?: string;
  role?: string;
  is_active?: boolean;
};

export const adminApi = {
  listUsers: () => apiGet<AdminUser[]>("/api/v1/admin/users"),
  createUser: (body: CreateAdminUserBody) =>
    apiPost<AdminUser>("/api/v1/admin/users", body),
  patchUser: (id: string, body: PatchAdminUserBody) =>
    apiPatch<AdminUser>(`/api/v1/admin/users/${id}`, body),
  resetPassword: (id: string, password: string) =>
    apiPost<{ ok: boolean }>(`/api/v1/admin/users/${id}/reset-password`, {
      password,
    }),
};

export function canManageUsers(role: string): boolean {
  return role === Role.SuperAdmin;
}

export const ROLE_OPTIONS = [
  {
    value: Role.SuperAdmin,
    label: "Super Admin",
    description: "Semua menu, termasuk mengelola pengguna.",
  },
  {
    value: Role.AdminGudang,
    label: "Admin Gudang",
    description: "Master data, persediaan masuk, setujui dan kirim permintaan, opname gudang.",
  },
  {
    value: Role.AdminKitchen,
    label: "Admin Dapur",
    description: "Resep, ajukan dan terima permintaan, akhir shift, opname dapur.",
  },
] as const;

/** "Rina Ayu" → "RA". Falls back to the first letter of the email when the name is empty. */
export function initials(fullName: string, email = ""): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] ?? email).slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Go's mux answers an unregistered route with plain text, which the JSON envelope parser turns
 * into a SyntaxError — so "the server has no user routes" and "the server broke" look different
 * only by message shape.
 */
export function isEndpointMissing(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("404") || m.includes("not found") || m.includes("unexpected token") || m.includes("json");
}

export const MIN_PASSWORD = 8;
