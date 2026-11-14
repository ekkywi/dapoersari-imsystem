"use client";

import { useState } from "react";

type PasswordFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  /** `lg` = 48px, for the login form. */
  size?: "md" | "lg";
  invalid?: boolean;
  placeholder?: string;
};

/**
 * Password input with a Tampilkan / Sembunyikan button. Put it inside a <label> (or give it an
 * id for a <label htmlFor>). The button's visible text is its name, so there is no aria-label
 * that could drift from it.
 */
export function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  size = "md",
  invalid = false,
  placeholder,
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  return (
    <div className={`ds-pw${size === "lg" ? " is-lg" : ""}${invalid ? " is-invalid" : ""}`}>
      <input
        id={id}
        className="ds-pw-input"
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="ds-pw-toggle"
        aria-controls={id}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? "Sembunyikan" : "Tampilkan"}
      </button>
    </div>
  );
}
