import { apiGet, apiPost } from "@/lib/api";

export type Unit = {
  id: string;
  code: string;
  name: string;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone?: string | null;
  note?: string | null;
  is_active: boolean;
  created_at: string;
};

export type Item = {
  id: string;
  sku: string;
  name: string;
  category_id?: string | null;
  unit_id: string;
  min_stock: number;
  is_active: boolean;
  created_at: string;
};

export type WarehouseStock = {
  item_id: string;
  qty: number;
  updated_at: string;
};

export type StockIn = {
  id: string;
  item_id: string;
  supplier_id?: string | null;
  qty: number;
  note?: string | null;
  expired_at?: string | null;
  created_by: string;
  created_at: string;
};

export type StockInResult = {
  stock_in: StockIn;
  stock: WarehouseStock;
};

export { canMutateWarehouse } from "@/lib/rbac";

export const warehouseApi = {
  listUnits: () => apiGet<Unit[]>("/api/v1/warehouse/units"),
  createUnit: (body: { code: string; name: string }) =>
    apiPost<Unit>("/api/v1/warehouse/units", body),

  listCategories: () => apiGet<Category[]>("/api/v1/warehouse/categories"),
  createCategory: (body: { name: string }) =>
    apiPost<Category>("/api/v1/warehouse/categories", body),

  listSuppliers: () => apiGet<Supplier[]>("/api/v1/warehouse/suppliers"),
  createSupplier: (body: {
    name: string;
    phone?: string | null;
    note?: string | null;
  }) => apiPost<Supplier>("/api/v1/warehouse/suppliers", body),

  listItems: () => apiGet<Item[]>("/api/v1/warehouse/items"),
  createItem: (body: {
    sku: string;
    name: string;
    category_id?: string | null;
    unit_id: string;
    min_stock: number;
  }) => apiPost<Item>("/api/v1/warehouse/items", body),

  listStocks: () => apiGet<WarehouseStock[]>("/api/v1/warehouse/stocks"),

  listStockIns: () => apiGet<StockIn[]>("/api/v1/warehouse/stock-ins"),
  createStockIn: (body: {
    item_id: string;
    supplier_id?: string | null;
    qty: number;
    note?: string | null;
    expired_at?: string | null;
  }) => apiPost<StockInResult>("/api/v1/warehouse/stock-ins", body),
};
