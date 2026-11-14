import { apiGet } from "@/lib/api";
import { formatDateOnly } from "@/lib/datetime";
import { docNo } from "@/lib/format";

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
      return "Akhir shift";
    case "opname_adjust":
      return "Penyesuaian opname";
    default:
      return reason;
  }
}

export function activityActionLabel(action: string): string {
  switch (action) {
    case "menu_closing.create":
      return "Akhir shift";
    case "opname.create_draft":
      return "Opname (draf)";
    case "opname.confirm":
      return "Opname dikonfirmasi";
    default:
      return action;
  }
}

/** What the activity log calls things, in the words the staff use. Unknown types fall back to the raw name. */
const ENTITY_LABEL: Record<string, { label: string; prefix?: "PRM" | "SIN" | "OPN" | "AKS" }> = {
  opname: { label: "Opname", prefix: "OPN" },
  menu_closing: { label: "Akhir shift", prefix: "AKS" },
  stock_request: { label: "Permintaan", prefix: "PRM" },
  stock_in: { label: "Persediaan masuk", prefix: "SIN" },
};

/** `Opname · OPN-1B9E44D2` instead of `opname · 1b9e44d2…`. */
export function activityEntityLabel(type?: string | null, id?: string | null): string {
  if (!type) return "—";
  const hit = ENTITY_LABEL[type];
  const label = hit?.label ?? type;
  if (!id) return label;
  return `${label} · ${hit?.prefix ? docNo(hit.prefix, id) : id.slice(0, 8)}`;
}

/**
 * The API writes `key=value` strings (`location=warehouse`, `closing_date=2026-10-30`).
 * Known keys become sentences; anything else is shown as it came.
 */
export function activityDetailLabel(detail?: string | null): string {
  if (!detail) return "—";
  const pairs = detail.split(/[\s,]+/).filter(Boolean);
  // Free text (no key=value shape) is shown untouched rather than chopped into words.
  if (pairs.length === 0 || !pairs.every((p) => p.includes("="))) return detail;
  return pairs
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq < 0) return pair;
      const key = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (key === "location") {
        return `Lokasi ${value === "kitchen" ? "Dapur" : value === "warehouse" ? "Gudang" : value}`;
      }
      if (key === "closing_date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return `Tanggal ${formatDateOnly(value)}`;
      }
      return pair;
    })
    .join(" · ");
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
