export type StockLevel = "ok" | "low" | "critical";

/**
 * Same rule as the API (docs/DOMAIN.md, smart layer):
 * effective <= 0 or <= half of min → critical; effective <= min → low.
 * `effective` is on-hand for the warehouse, on-hand + in-transit for the kitchen.
 */
export function stockLevel(effective: number, min: number): StockLevel {
  if (min <= 0) return effective <= 0 ? "critical" : "ok";
  if (effective <= 0 || effective <= 0.5 * min) return "critical";
  if (effective <= min) return "low";
  return "ok";
}

/** Gauge fill in percent: effective ÷ (2 × min), clamped to 3–100. */
export function gaugePercent(effective: number, min: number): number {
  if (min <= 0) return 100;
  const pct = (effective / (2 * min)) * 100;
  return Math.min(100, Math.max(3, pct));
}
