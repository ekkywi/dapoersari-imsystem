import type { InputHTMLAttributes } from "react";

type UnitInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Unit suffix shown in a box on the right: kg, btr, l … */
  unit?: string;
  invalid?: boolean;
};

/**
 * Number input with the unit attached on the right. Give it an `id` + <label>, or an
 * `aria-label`; the suffix is decoration for sighted users and is repeated in the hint.
 */
export function UnitInput({
  unit,
  invalid = false,
  className = "",
  ...rest
}: UnitInputProps) {
  return (
    <div
      className={`ds-unit-input${invalid ? " is-invalid" : ""} ${className}`.trim()}
    >
      <input
        className="ds-unit-input-field ds-num"
        type="number"
        inputMode="decimal"
        aria-invalid={invalid || undefined}
        {...rest}
      />
      {unit ? (
        <span className="ds-unit-input-suffix" aria-hidden="true">
          {unit}
        </span>
      ) : null}
    </div>
  );
}
