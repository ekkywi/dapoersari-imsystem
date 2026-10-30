/** Role codes — keep in sync with API auth.Role* */

export const Role = {
  SuperAdmin: "super_admin",
  AdminGudang: "admin_gudang",
  AdminKitchen: "admin_kitchen",
} as const;

export type RoleCode = (typeof Role)[keyof typeof Role];

export type NavKey =
  | "overview"
  | "units"
  | "categories"
  | "suppliers"
  | "items"
  | "stocks"
  | "stock-ins"
  | "menus"
  | "kitchen-stocks"
  | "stock-requests-warehouse"
  | "stock-requests-kitchen"
  | "closings"
  | "opname-warehouse"
  | "opname-kitchen"
  | "history"
  | "alerts"
  | "users";

/** Menus that exist today, filtered by role. */
export function navKeysForRole(role: string): Set<NavKey> {
  switch (role) {
    case Role.SuperAdmin:
      return new Set<NavKey>([
        "overview",
        "alerts",
        "units",
        "categories",
        "suppliers",
        "items",
        "stocks",
        "stock-ins",
        "stock-requests-warehouse",
        "opname-warehouse",
        "menus",
        "kitchen-stocks",
        "stock-requests-kitchen",
        "closings",
        "opname-kitchen",
        "history",
      ]);
    case Role.AdminGudang:
      return new Set<NavKey>([
        "overview",
        "alerts",
        "units",
        "categories",
        "suppliers",
        "items",
        "stocks",
        "stock-ins",
        "stock-requests-warehouse",
        "opname-warehouse",
        "history",
      ]);
    case Role.AdminKitchen:
      return new Set<NavKey>([
        "overview",
        "alerts",
        "menus",
        "kitchen-stocks",
        "stock-requests-kitchen",
        "closings",
        "opname-kitchen",
        "stocks",
        "history",
      ]);
    default:
      return new Set<NavKey>(["overview"]);
  }
}

export function canAccessStockRequests(role: string): boolean {
  const keys = navKeysForRole(role);
  return (
    keys.has("stock-requests-warehouse") || keys.has("stock-requests-kitchen")
  );
}

export function canAccessOpnames(role: string): boolean {
  const keys = navKeysForRole(role);
  return keys.has("opname-warehouse") || keys.has("opname-kitchen");
}

export function canMutateWarehouse(role: string): boolean {
  return role === Role.SuperAdmin || role === Role.AdminGudang;
}

export function canMutateKitchen(role: string): boolean {
  return role === Role.SuperAdmin || role === Role.AdminKitchen;
}

export function roleLabel(role: string): string {
  switch (role) {
    case Role.SuperAdmin:
      return "Super Admin";
    case Role.AdminGudang:
      return "Admin Gudang";
    case Role.AdminKitchen:
      return "Admin Dapur";
    default:
      return role.replaceAll("_", " ");
  }
}

export type RequestFocus = "warehouse" | "kitchen";

export function parseRequestFocus(raw: string | null): RequestFocus | null {
  if (raw === "warehouse" || raw === "kitchen") return raw;
  return null;
}

/** Default statuses for each entry door (optional UI filter). */
export function defaultStatusesForFocus(focus: RequestFocus): string[] {
  if (focus === "warehouse") {
    return ["submitted", "approved"];
  }
  return ["submitted", "transferred"];
}

/**
 * UI actions follow the entry door (`focus`), not only role.
 * Super Admin can do both, but only via the matching menu.
 */
export function showWarehouseRequestActions(
  role: string,
  focus: RequestFocus | null,
): boolean {
  if (!canMutateWarehouse(role)) return false;
  if (focus === "kitchen") return false;
  if (focus === "warehouse") return true;
  return !canMutateKitchen(role);
}

export function showKitchenRequestActions(
  role: string,
  focus: RequestFocus | null,
): boolean {
  if (!canMutateKitchen(role)) return false;
  if (focus === "warehouse") return false;
  if (focus === "kitchen") return true;
  return !canMutateWarehouse(role);
}

/** Opname mutate UI: role + door. */
export function showOpnameMutate(
  role: string,
  focus: RequestFocus | null,
): boolean {
  if (focus === "warehouse") return canMutateWarehouse(role);
  if (focus === "kitchen") return canMutateKitchen(role);
  if (canMutateWarehouse(role) && !canMutateKitchen(role)) return true;
  if (canMutateKitchen(role) && !canMutateWarehouse(role)) return true;
  return false;
}

export function canManageUsers(role: string): boolean {
  return role === Role.SuperAdmin;
}