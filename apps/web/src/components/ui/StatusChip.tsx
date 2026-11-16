import type { ReactNode } from "react";

export type ChipTone = "neutral" | "info" | "warn" | "ok" | "danger";

const REQUEST_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  submitted: { label: "Diajukan", tone: "neutral" },
  approved: { label: "Disetujui", tone: "info" },
  // The API says "transferred"; the kitchen calls it "dalam perjalanan".
  transferred: { label: "Dalam perjalanan", tone: "warn" },
  received: { label: "Diterima", tone: "ok" },
  rejected: { label: "Ditolak", tone: "danger" },
};

const OPNAME_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  draft: { label: "Draf", tone: "neutral" },
  confirmed: { label: "Dikonfirmasi", tone: "ok" },
  cancelled: { label: "Dibatalkan", tone: "danger" },
};

type StatusChipProps = { size?: "md" | "lg" } & (
  | { kind: "request" | "opname"; status: string }
  | { tone: ChipTone; children: ReactNode }
);

/** Pill with dot + label. Use `kind`+`status` for documents, or `tone` for ad-hoc chips (Kritis, Menipis). */
export function StatusChip(props: StatusChipProps) {
  let tone: ChipTone;
  let label: ReactNode;
  if ("kind" in props) {
    const table = props.kind === "request" ? REQUEST_STATUS : OPNAME_STATUS;
    const hit = table[props.status];
    tone = hit?.tone ?? "neutral";
    label = hit?.label ?? props.status;
  } else {
    tone = props.tone;
    label = props.children;
  }
  const cls = `ds-chip ds-chip-${tone}${props.size === "lg" ? " ds-chip-lg" : ""}`;
  return (
    <span className={cls}>
      <span className="ds-chip-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
