import { round3 } from "@/lib/request-stock";

export type VarianceKind = "uncounted" | "match" | "over" | "under" | "invalid";

/** Reads a physical-count input: empty = not counted yet (null), junk or negative = invalid. */
export function parsePhysical(raw: string): number | null | "invalid" {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return n;
}

/**
 * Surplus is `over` (blue, +), deficit is `under` (red, −). A count of 0 is a real count —
 * only an empty field means "belum dihitung".
 */
export function varianceOf(
  system: number,
  physical: number | null | "invalid",
): { kind: VarianceKind; diff: number } {
  if (physical === "invalid") return { kind: "invalid", diff: 0 };
  if (physical === null) return { kind: "uncounted", diff: 0 };
  const diff = round3(physical - system);
  if (diff === 0) return { kind: "match", diff: 0 };
  return { kind: diff > 0 ? "over" : "under", diff };
}

export type OpnameSummary = {
  total: number;
  counted: number;
  match: number;
  over: number;
  under: number;
  uncounted: number;
};

export function summarize(kinds: VarianceKind[]): OpnameSummary {
  const s: OpnameSummary = { total: kinds.length, counted: 0, match: 0, over: 0, under: 0, uncounted: 0 };
  for (const k of kinds) {
    if (k === "match") s.match += 1;
    else if (k === "over") s.over += 1;
    else if (k === "under") s.under += 1;
    else s.uncounted += 1;
  }
  s.counted = s.match + s.over + s.under;
  return s;
}
