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
  { value: Role.SuperAdmin, label: "Super Admin" },
  { value: Role.AdminGudang, label: "Admin Gudang" },
  { value: Role.AdminKitchen, label: "Admin Dapur" },
] as const;
