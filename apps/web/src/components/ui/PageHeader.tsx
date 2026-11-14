import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Location tag ("Pintu gudang") or a date. 13px, muted unless it is a LocationTag. */
  kicker?: ReactNode;
  title: ReactNode;
  /** Sits next to the title, e.g. a StatusChip on a document page. */
  titleAside?: ReactNode;
  /** Set for document numbers (PRM-…): mono title. */
  mono?: boolean;
  /** One line under the title. */
  lede?: ReactNode;
  /** 14px instead of 15px — for document pages whose lede is a metadata line. */
  compactLede?: boolean;
  /** One primary action + secondaries. Wraps below the text on narrow screens. */
  actions?: ReactNode;
  /** Sentence under the actions. Use it to say why a button is disabled. */
  actionsNote?: ReactNode;
  /** `start` for document pages whose header has several lines; `end` otherwise. */
  align?: "start" | "end";
};

export function PageHeader({
  kicker,
  title,
  titleAside,
  mono = false,
  lede,
  compactLede = false,
  actions,
  actionsNote,
  align = "end",
}: PageHeaderProps) {
  return (
    <header className={`ds-page-header${align === "start" ? " is-start" : ""}`}>
      <div className="ds-page-header-text">
        {kicker ? <div className="ds-page-kicker">{kicker}</div> : null}
        {titleAside ? (
          <div className="ds-page-title-row">
            <h1 className={`ds-page-title${mono ? " ds-num" : ""}`}>{title}</h1>
            {titleAside}
          </div>
        ) : (
          <h1 className={`ds-page-title${mono ? " ds-num" : ""}`}>{title}</h1>
        )}
        {lede ? (
          <div className={`ds-page-lede${compactLede ? " is-compact" : ""}`}>{lede}</div>
        ) : null}
      </div>
      {actions || actionsNote ? (
        <div className="ds-page-actions-col">
          {actions ? <div className="ds-page-actions">{actions}</div> : null}
          {actionsNote ? <p className="ds-page-actions-note">{actionsNote}</p> : null}
        </div>
      ) : null}
    </header>
  );
}
