type StepPillsProps = {
  steps: string[];
  /** Zero-based index of the step the user is on. Earlier steps read as done. */
  current: number;
  label?: string;
  /** All steps done (e.g. a confirmed document). */
  complete?: boolean;
};

/** Numbered pills: where am I in a multi-step document flow. Not clickable. */
export function StepPills({ steps, current, label = "Langkah", complete = false }: StepPillsProps) {
  return (
    <ol className="ds-steps" aria-label={label}>
      {steps.map((text, i) => {
        const state = complete || i < current ? "is-done" : i === current ? "is-current" : "is-todo";
        return (
          <li
            key={text}
            className={`ds-step ${state}`}
            aria-current={!complete && i === current ? "step" : undefined}
          >
            <span className="ds-num">{i + 1}</span> {text}
          </li>
        );
      })}
    </ol>
  );
}
