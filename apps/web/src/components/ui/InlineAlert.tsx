import type { ReactNode } from "react";

export type AlertTone = "danger" | "warn" | "info" | "ok";

function AlertIcon({ tone }: { tone: AlertTone }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
    className: "ds-alert-icon",
  } as const;
  if (tone === "ok") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M8 12.5l3 3 5-6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tone === "info") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 11v5.5M12 7.5v.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (tone === "warn") {
    return (
      <svg {...common}>
        <path
          d="M12 4 21 19.5H3L12 4Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M12 10v4.5M12 17v.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M12 7v6M12 16.5v.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

type InlineAlertProps = {
  tone?: AlertTone;
  /** Say the problem: "Telur kurang 12 butir di gudang". */
  title: ReactNode;
  /** Then the consequence and what the user can do about it. */
  children?: ReactNode;
  /** Links/buttons, usually `<LinkButton variant="secondary" size="sm">`. */
  actions?: ReactNode;
  /** `alert` interrupts screen readers; default `status` is polite. */
  role?: "status" | "alert";
};

/** Full-border tinted box. Deliberately not a left-border card. */
export function InlineAlert({
  tone = "danger",
  title,
  children,
  actions,
  role = "status",
}: InlineAlertProps) {
  return (
    <div className={`ds-alert ds-alert-${tone}`} role={role}>
      <AlertIcon tone={tone} />
      <div className="ds-alert-body">
        <p className="ds-alert-title">{title}</p>
        {children ? <div className="ds-alert-text">{children}</div> : null}
      </div>
      {actions ? <div className="ds-alert-actions">{actions}</div> : null}
    </div>
  );
}
