import { formatQty } from "@/lib/format";
import { gaugePercent, stockLevel, type StockLevel } from "@/lib/stock-level";

const LEVEL_WORD: Record<StockLevel, string> = {
  ok: "aman",
  low: "menipis",
  critical: "kritis",
};

type MinGaugeProps = {
  /** On-hand for the warehouse; on-hand + in-transit for the kitchen. */
  effective: number;
  min: number;
  unit?: string;
  /** Hide the "min 7 kg" caption when the column already says it. */
  hideCaption?: boolean;
  /** `stacked` puts the caption under the bar (tables); `inline` puts it to the right. */
  layout?: "inline" | "stacked";
};

/**
 * Bar against the minimum: full = 2 × min, the tick at 50% is the minimum itself.
 * Colour is a hint only — the caption and aria-label carry the facts.
 */
export function MinGauge({
  effective,
  min,
  unit,
  hideCaption = false,
  layout = "inline",
}: MinGaugeProps) {
  const level = stockLevel(effective, min);
  const pct = gaugePercent(effective, min);
  const label = `Stok ${formatQty(effective, unit)}, minimum ${formatQty(min, unit)}, ${LEVEL_WORD[level]}`;
  return (
    <div className={`ds-gauge-wrap${layout === "stacked" ? " is-stacked" : ""}`}>
      <div className={`ds-gauge ds-gauge-${level}`} role="img" aria-label={label}>
        <div className="ds-gauge-fill" style={{ width: `${pct}%` }} />
        <div className="ds-gauge-tick" />
      </div>
      {hideCaption ? null : (
        <span className="ds-num ds-gauge-caption">min {formatQty(min, unit)}</span>
      )}
    </div>
  );
}
