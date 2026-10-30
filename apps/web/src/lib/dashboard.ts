import { apiGet } from "@/lib/api";

export type DashboardSummary = {
  warehouse_low_stock: number;
  kitchen_low_stock: number;
  pending_approvals: number;
  awaiting_transfer: number;
  in_transit_requests: number;
  active_items: number;
  active_menus: number;
  lead_time_days: number;
  order_interval_days: number;
};

export type LowStockAlert = {
  item_id: string;
  sku: string;
  name: string;
  unit_code: string;
  category_name?: string | null;
  location: string;
  qty: number;
  in_transit: number;
  effective_qty: number;
  min_stock: number;
  level: "low" | "critical" | string;
};

export function alertLevelLabel(level: string): string {
  switch (level) {
    case "critical":
      return "Kritis";
    case "low":
      return "Menipis";
    default:
      return level;
  }
}

export function locationLabel(location: string): string {
  return location === "kitchen" ? "Dapur" : "Gudang";
}

export const dashboardApi = {
  summary: () => apiGet<DashboardSummary>("/api/v1/dashboard/summary"),
  lowStock: (location?: string) => {
    const q = location ? `?location=${encodeURIComponent(location)}` : "";
    return apiGet<LowStockAlert[]>(`/api/v1/alerts/low-stock${q}`);
  },
};
