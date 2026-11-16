/** Indonesian number formatting for quantities. Max 3 decimals, trailing zeros dropped. */
export function formatQty(n: number, unit?: string): string {
  const s = Number(n.toFixed(3)).toLocaleString("id-ID", {
    maximumFractionDigits: 3,
  });
  return unit ? `${s} ${unit}` : s;
}

/** Quantity with an explicit sign: `+6`, `−1,5` (real minus sign), `0` stays unsigned. */
export function signedQty(n: number, unit?: string): string {
  return (n > 0 ? "+" : n < 0 ? "−" : "") + formatQty(Math.abs(n), unit);
}

/** Human document number from a UUID: `PRM-1B9E44D2`. */
export function docNo(prefix: "PRM" | "SIN" | "OPN" | "AKS", id: string): string {
  return `${prefix}-${id.slice(0, 8).toUpperCase()}`;
}
