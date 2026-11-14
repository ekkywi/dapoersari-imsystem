"use client";

type StepperProps = {
  value: number;
  onChange: (next: number) => void;
  /** What is being counted, e.g. "Nasi Ayam Bakar". Used for screen-reader labels. */
  label: string;
  /** Noun for the input label: "Jumlah paket …". */
  noun?: string;
  /** How much − and + change the value. The input itself accepts any whole number. */
  step?: number;
  /** `lg` = 48px, for the shift-closing grid. */
  size?: "md" | "lg";
  max?: number;
  disabled?: boolean;
  /** Stretch to the container width (the input takes the free space). */
  fill?: boolean;
};

function clamp(n: number, max?: number): number {
  const whole = Number.isFinite(n) ? Math.floor(n) : 0;
  const floored = Math.max(0, whole);
  return max === undefined ? floored : Math.min(floored, max);
}

/** Keep digits only, so "05" or "1e3" can never reach state. Empty → 0. */
function parseDigits(raw: string, max?: number): number {
  const digits = raw.replace(/\D/g, "");
  return clamp(digits === "" ? 0 : Number(digits), max);
}

/** − [input] +, whole numbers only, never below 0. */
export function Stepper({
  value,
  onChange,
  label,
  noun = "paket",
  step = 1,
  size = "md",
  max,
  disabled = false,
  fill = false,
}: StepperProps) {
  return (
    <div
      className={`ds-stepper${size === "lg" ? " ds-stepper-lg" : ""}${fill ? " ds-stepper-fill" : ""}`}
    >
      <button
        type="button"
        className="ds-stepper-btn"
        aria-label={`Kurangi ${label}`}
        disabled={disabled || value <= 0}
        onClick={() => onChange(clamp(value - step, max))}
      >
        −
      </button>
      <input
        className="ds-stepper-input ds-num"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        disabled={disabled}
        aria-label={`Jumlah ${noun} ${label}`}
        value={String(value)}
        onChange={(e) => onChange(parseDigits(e.target.value, max))}
      />
      <button
        type="button"
        className="ds-stepper-btn"
        aria-label={`Tambah ${label}`}
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(clamp(value + step, max))}
      >
        +
      </button>
    </div>
  );
}
