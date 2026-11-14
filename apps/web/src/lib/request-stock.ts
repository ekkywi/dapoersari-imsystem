import { stockLevel } from "@/lib/stock-level";
import type { StockRequestLine } from "@/lib/transfer";

/** Floating-point sums (0.1 + 0.2) must not read as a shortage of 0.00000000004. */
export function round3(n: number): number {
  return Number(n.toFixed(3));
}

export type LineCheck = {
  line: StockRequestLine;
  /** Warehouse on-hand right now. */
  stock: number;
  /** What would remain after the transfer; negative = the transfer would be rejected. */
  after: number;
  /** How much the warehouse lacks, 0 when it has enough. */
  shortBy: number;
  /** Item minimum, null when unknown or not set. */
  min: number | null;
  /** Enough stock, but the remainder would sit at or under the minimum. */
  belowMin: boolean;
};

/** Compares each merged request line with warehouse stock and the item minimum. */
export function checkLines(
  lines: StockRequestLine[],
  stock: Map<string, number>,
  mins: Map<string, number>,
): LineCheck[] {
  return lines.map((line) => {
    const onHand = stock.get(line.item_id) ?? 0;
    const after = round3(onHand - line.qty);
    const shortBy = after < 0 ? round3(-after) : 0;
    const minRaw = mins.get(line.item_id);
    const min = minRaw !== undefined && minRaw > 0 ? minRaw : null;
    const belowMin = min !== null && after >= 0 && stockLevel(after, min) !== "ok";
    return { line, stock: onHand, after, shortBy, min, belowMin };
  });
}

export function shortages(checks: LineCheck[]): LineCheck[] {
  return checks.filter((c) => c.shortBy > 0);
}
