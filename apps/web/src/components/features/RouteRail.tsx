import type { ReactNode } from "react";
import { LocationTag, type Location } from "@/components/ui/LocationTag";

export type RouteStepState = "done" | "current" | "todo";

export type RouteStep = {
  key: string;
  label: string;
  state: RouteStepState;
  /** Who does this step: draws ■ Gudang or ● Dapur before `meta`. */
  location?: Location;
  /** Time once done ("09:02"), or the effect while pending ("stok gudang berkurang"). */
  meta?: ReactNode;
};

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type RouteRailProps = {
  steps: RouteStep[];
  label?: string;
};

/**
 * Lifecycle of a stock request. done = filled navy + check, current = ring with dot,
 * todo = grey ring. Each step says who acts and what happens to stock.
 */
export function RouteRail({ steps, label = "Tahapan dokumen" }: RouteRailProps) {
  return (
    <section className="ds-rail" aria-label={label}>
      <ol className="ds-rail-list">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <li
              key={step.key}
              className={`ds-rail-step is-${step.state}`}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              <div className="ds-rail-track">
                <span className="ds-rail-node" aria-hidden="true">
                  {step.state === "done" ? <Check /> : null}
                  {step.state === "current" ? <span className="ds-rail-node-dot" /> : null}
                </span>
                {last ? null : <span className="ds-rail-link" aria-hidden="true" />}
              </div>
              <span className="ds-rail-label">{step.label}</span>
              {step.location || step.meta ? (
                <span className="ds-rail-meta">
                  {step.location ? <LocationTag location={step.location} /> : null}
                  {step.location && step.meta ? " · " : null}
                  {step.meta}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
