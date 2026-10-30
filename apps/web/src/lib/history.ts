import { apiGet } from "@/lib/api";

export type StockHistoryEntry = {
  id: string;
  item_id: string;
  item_sku: string;
  item_name: string;
  unit_code: string;
  location: string;
  delta: number;
  qty_after: number;
  reason: string;
  ref_type?: string | null;
  ref_id?: string | null;
  created_by?: string | null;
  created_at: string;
};

export type ActivityEntry = {
  id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  detail?: string | null;
  created_at: string;
};

export function stockReasonLabel(reason: string): string {
  switch (reason) {
    case "stock_in":
      return "Persediaan masuk";
    case "transfer_out":
      return "Transfer keluar";
    case "transfer_in":
      return "Transfer masuk";
    case "menu_closing":
      return "Akhir Shift";
    case "opname_adjust":
      return "Penyesuaian opname";
    default:
      return reason;
  }
}

export function activityActionLabel(action: string): string {
  switch (action) {
    case "menu_closing.create":
      return "Akhir Shift";
    case "opname.create_draft":
      return "Opname (draf)";
    case "opname.confirm":
      return "Opname dikonfirmasi";
    default:
      return action;
  }
}

export const historyApi = {
  listStock: (params?: { location?: string; item_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.location) q.set("location", params.location);
    if (params?.item_id) q.set("item_id", params.item_id);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiGet<StockHistoryEntry[]>(
      `/api/v1/history/stock${qs ? `?${qs}` : ""}`,
    );
  },
  listActivity: (limit = 50) =>
    apiGet<ActivityEntry[]>(`/api/v1/history/activity?limit=${limit}`),
};
