import { round3 } from "@/lib/request-stock";

export type ItemInfo = { name: string; sku: string; unit: string };

export type DraftRecipe = {
  menuId: string;
  lines: { item_id: string; qty_per_paket: number }[];
};

export type DraftExtra = { item_id: string; qty: number };

export type DraftLine = {
  item_id: string;
  name: string;
  unit: string;
  qty: number;
  fromRecipe: number;
  fromExtra: number;
  /** Warehouse on-hand, null if the stock list does not know the item. */
  stock: number | null;
  /** How much the warehouse lacks, 0 when it has enough. */
  shortBy: number;
};

export function sourceLabel(line: Pick<DraftLine, "fromRecipe" | "fromExtra">): string {
  if (line.fromRecipe > 0 && line.fromExtra > 0) return "resep + item tambahan";
  return line.fromExtra > 0 ? "item tambahan" : "dari resep";
}

/**
 * What the warehouse will receive: recipe lines × paket qty plus extra items, merged per
 * item. The server does the same merge and snapshots the result when the request is
 * created, so this is a preview of that document — never a replacement for it.
 */
export function buildDraftLines(
  recipes: DraftRecipe[],
  paketQty: Record<string, number>,
  extras: DraftExtra[],
  info: Map<string, ItemInfo>,
  stock: Map<string, number>,
): DraftLine[] {
  const byItem = new Map<string, DraftLine>();

  function bucket(itemId: string): DraftLine {
    let row = byItem.get(itemId);
    if (!row) {
      const meta = info.get(itemId);
      const onHand = stock.get(itemId);
      row = {
        item_id: itemId,
        name: meta?.name ?? "Item tidak dikenal",
        unit: meta?.unit ?? "",
        qty: 0,
        fromRecipe: 0,
        fromExtra: 0,
        stock: onHand ?? null,
        shortBy: 0,
      };
      byItem.set(itemId, row);
    }
    return row;
  }

  for (const recipe of recipes) {
    const paket = paketQty[recipe.menuId] ?? 0;
    if (paket <= 0) continue;
    for (const line of recipe.lines) {
      const row = bucket(line.item_id);
      row.fromRecipe += line.qty_per_paket * paket;
    }
  }
  for (const extra of extras) {
    if (extra.qty <= 0) continue;
    bucket(extra.item_id).fromExtra += extra.qty;
  }

  const out = [...byItem.values()];
  for (const row of out) {
    row.fromRecipe = round3(row.fromRecipe);
    row.fromExtra = round3(row.fromExtra);
    row.qty = round3(row.fromRecipe + row.fromExtra);
    row.shortBy = row.stock !== null && row.qty > row.stock ? round3(row.qty - row.stock) : 0;
  }
  return out;
}
