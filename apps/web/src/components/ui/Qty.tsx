import { formatQty, signedQty } from "@/lib/format";

type QtyProps = {
  value: number;
  unit?: string;
  tone?: "danger" | "warn" | "info";
  /** Show `+6` / `−1,5` instead of the bare number. */
  signed?: boolean;
  className?: string;
};

/** Mono, tabular quantity. Alignment (right in tables) is the cell's job. */
export function Qty({ value, unit, tone, signed = false, className = "" }: QtyProps) {
  const text = signed ? signedQty(value, unit) : formatQty(value, unit);
  const cls = ["ds-num", tone ? `ds-tone-${tone}` : "", className]
    .filter(Boolean)
    .join(" ");
  return <span className={cls}>{text}</span>;
}
