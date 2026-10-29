import { apiGet, apiPost, apiPut } from "@/lib/api";

export type RecipeLine = {
  id: string;
  menu_id: string;
  item_id: string;
  qty_per_paket: number;
  item_sku?: string;
  item_name?: string;
  unit_code?: string;
};

export type Menu = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  lines?: RecipeLine[];
};

export type KitchenStock = {
  item_id: string;
  qty: number;
  updated_at: string;
};

export type MenuClosingPackage = {
  id: string;
  closing_id: string;
  menu_id?: string | null;
  menu_name: string;
  qty_paket: number;
};

export type MenuClosingLine = {
  id: string;
  closing_id: string;
  item_id: string;
  item_sku: string;
  item_name: string;
  unit_code: string;
  qty: number;
};

export type MenuClosing = {
  id: string;
  closing_date: string;
  note?: string | null;
  created_by: string;
  created_at: string;
  packages?: MenuClosingPackage[];
  lines?: MenuClosingLine[];
};

export const kitchenApi = {
  listMenus: () => apiGet<Menu[]>("/api/v1/kitchen/menus"),
  getMenu: (id: string) => apiGet<Menu>(`/api/v1/kitchen/menus/${id}`),
  createMenu: (body: {
    name: string;
    lines: { item_id: string; qty_per_paket: number }[];
  }) => apiPost<Menu>("/api/v1/kitchen/menus", body),
  replaceRecipe: (
    id: string,
    body: { lines: { item_id: string; qty_per_paket: number }[] },
  ) => apiPut<Menu>(`/api/v1/kitchen/menus/${id}/recipe`, body),
  listStocks: () => apiGet<KitchenStock[]>("/api/v1/kitchen/stocks"),
  listClosings: () => apiGet<MenuClosing[]>("/api/v1/kitchen/closings"),
  getClosing: (id: string) =>
    apiGet<MenuClosing>(`/api/v1/kitchen/closings/${id}`),
  createClosing: (body: {
    closing_date: string;
    note?: string | null;
    packages: { menu_id: string; qty_paket: number }[];
  }) => apiPost<MenuClosing>("/api/v1/kitchen/closings", body),
};
