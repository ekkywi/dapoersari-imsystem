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
  qty_transferred?: number | null;
  qty_received?: number | null;
  receive_note?: string | null;
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
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
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
    case "cancelled":
      return "Dibatalkan";
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
  approve: (id: string, allowShortage = false) =>
    apiPost<StockRequest>(`/api/v1/stock-requests/${id}/approve`, {
      allow_shortage: allowShortage,
    }),
  reject: (id: string, reason: string) =>
    apiPost<StockRequest>(`/api/v1/stock-requests/${id}/reject`, { reason }),
  cancel: (id: string, reason: string) =>
    apiPost<StockRequest>(`/api/v1/stock-requests/${id}/cancel`, { reason }),
  transfer: (id: string, lines?: { line_id: string; qty: number }[]) =>
    apiPost<StockRequest>(`/api/v1/stock-requests/${id}/transfer`, lines ? { lines } : {}),
  receive: (
    id: string,
    lines?: { line_id: string; qty_received: number; note?: string | null }[],
  ) =>
    apiPost<StockRequest>(`/api/v1/stock-requests/${id}/receive`, lines ? { lines } : {}),
};

/** Badge class per status (list + detail). */
export function requestStatusBadge(status: string): string {
  switch (status) {
    case "received":
      return "badge badge-success";
    case "rejected":
    case "cancelled":
      return "badge badge-danger";
    case "submitted":
    case "approved":
    case "transferred":
      return "badge badge-warn";
    default:
      return "badge badge-neutral";
  }
}
