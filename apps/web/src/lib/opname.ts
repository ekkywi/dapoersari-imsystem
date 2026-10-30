import { apiGet, apiPost } from "@/lib/api";

export type OpnameLine = {
  id: string;
  opname_id: string;
  item_id: string;
  item_sku: string;
  item_name: string;
  unit_code: string;
  category_name?: string | null;
  system_qty: number;
  physical_qty: number;
  variance: number;
};

export type Opname = {
  id: string;
  location: "warehouse" | "kitchen" | string;
  status: string;
  note?: string | null;
  created_by: string;
  created_at: string;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  lines?: OpnameLine[];
};

export function opnameStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draf";
    case "confirmed":
      return "Dikonfirmasi";
    case "cancelled":
      return "Dibatalkan";
    default:
      return status;
  }
}

export function opnameLocationLabel(location: string): string {
  return location === "kitchen" ? "Dapur" : "Gudang";
}

export const opnameApi = {
  list: (location?: string) => {
    const q = location ? `?location=${encodeURIComponent(location)}` : "";
    return apiGet<Opname[]>(`/api/v1/opnames${q}`);
  },
  get: (id: string) => apiGet<Opname>(`/api/v1/opnames/${id}`),
  create: (body: {
    location: string;
    note?: string | null;
    lines: { item_id: string; physical_qty: number }[];
  }) => apiPost<Opname>("/api/v1/opnames", body),
  confirm: (id: string) => apiPost<Opname>(`/api/v1/opnames/${id}/confirm`, {}),
};
