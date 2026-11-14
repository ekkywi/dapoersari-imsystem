"use client";

import { ROLE_OPTIONS } from "@/lib/admin";

type RoleRadioGroupProps = {
  name: string;
  value: string;
  onChange: (role: string) => void;
};

/** Role as three cards, each saying in one line what that role can do. */
export function RoleRadioGroup({ name, value, onChange }: RoleRadioGroupProps) {
  return (
    <fieldset className="ds-roles">
      <legend className="ds-roles-legend">Peran</legend>
      {ROLE_OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className={`ds-role-card${value === opt.value ? " is-selected" : ""}`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span className="ds-role-text">
            <span className="ds-role-name">{opt.label}</span>
            <span className="ds-role-desc">{opt.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
