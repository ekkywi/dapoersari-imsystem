import { apiGet, apiPost } from "@/lib/api";

export type StockRequestPackage = {
  id: string;
  request_id: string;
  menu_id?: string | null;
  menu_name: string;
  qty_paket: number;
};

export type StockRequestLine = {
  id: string;
  request_id: string;
  item_id: string;
  item_sku: string;
  item_name: string;
  unit_code: string;
  category_name?: string | null;
  qty: number;
};

export type StockRequest = {
  id: string;
  status: string;
  note?: string | null;
  created_by: string;
  created_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  transferred_by?: string | null;
  transferred_at?: string | null;
  received_by?: string | null;
  received_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  reject_reason?: string | null;
  packages?: StockRequestPackage[];
  lines?: StockRequestLine[];
};

export function requestStatusLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "Diajukan";
    case "approved":
      return "Disetujui";
    case "transferred":
      return "Ditransfer";
    case "received":
      return "Diterima";
    case "rejected":
      return "Ditolak";
    default:
      return status;
  }
}

export const transferApi = {
  list: () => apiGet<StockRequest[]>("/api/v1/stock-requests"),
  get: (id: string) => apiGet<StockRequest>(`/api/v1/stock-requests/${id}`),
  create: (body: {
    note?: string | null;
    packages?: { menu_id: string; qty_paket: number }[];
    extra_items?: { item_id: string; qty: number }[];
  }) => apiPost<StockRequest>("/api/v1/stock-requests", body),
  approve: (id: string) =>
    apiPost<StockRequest>(`/api/v1/stock-requests/${id}/approve`, {}),
  reject: (id: string, reason: string) =>
    apiPost<StockRequest>(`/api/v1/stock-requests/${id}/reject`, { reason }),
  transfer: (id: string) =>
    apiPost<StockRequest>(`/api/v1/stock-requests/${id}/transfer`, {}),
  receive: (id: string) =>
    apiPost<StockRequest>(`/api/v1/stock-requests/${id}/receive`, {}),
};
