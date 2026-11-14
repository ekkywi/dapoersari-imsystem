/** Letters only, first letter kept, later vowels dropped: "Telur puyuh" → "TLR". */
export function skuPrefix(name: string): string {
  const letters = name.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase();
  if (!letters) return "";
  return (letters[0] + letters.slice(1).replace(/[AEIOU]/g, "")).slice(0, 3);
}

/**
 * Suggests `PREFIX-NNN` from the name: the number continues after the highest existing SKU that
 * shares the prefix ("Telur puyuh" with TLR-001 present → TLR-002). It is only a suggestion; the
 * user can edit it, and duplicates are caught before saving.
 */
export function suggestSku(name: string, existing: string[]): string {
  const prefix = skuPrefix(name);
  if (!prefix) return "";
  let max = 0;
  for (const sku of existing) {
    const m = /^([A-Za-z]+)-(\d+)$/.exec(sku.trim());
    if (m && m[1].toUpperCase() === prefix) max = Math.max(max, Number(m[2]));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export function normalizeSku(raw: string): string {
  return raw.trim().toUpperCase();
}

/** The API answers a unique-constraint hit with a bare 500; say what is most likely wrong. */
export function explainMasterError(message: string, noun: string): string {
  if (message.startsWith("gagal")) {
    return `Server menolak data ini. Kemungkinan ${noun} sudah dipakai atau ada isian yang tidak valid.`;
  }
  return message;
}

export const MASTER_TABS = [
  { id: "items", label: "Item", href: "/app/warehouse/items" },
  { id: "units", label: "Satuan", href: "/app/warehouse/units" },
  { id: "categories", label: "Kategori", href: "/app/warehouse/categories" },
  { id: "suppliers", label: "Pemasok", href: "/app/warehouse/suppliers" },
] as const;

export type MasterTabId = (typeof MASTER_TABS)[number]["id"];
