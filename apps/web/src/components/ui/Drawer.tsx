"use client";

import { useEffect } from "react";

type DrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional pinned footer (Batal / Simpan). Existing callers keep their buttons inside the body. */
  footer?: React.ReactNode;
};

export function Drawer({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-root" role="presentation">
      <button
        type="button"
        className="drawer-backdrop"
        aria-label="Tutup panel"
        onClick={onClose}
      />
      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <header className="drawer-header">
          <div>
            <h2 id="drawer-title" className="drawer-title">
              {title}
            </h2>
            {description ? (
              <p className="drawer-desc">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="drawer-close"
            aria-label="Tutup"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="ds-drawer-footer">{footer}</div> : null}
      </aside>
    </div>
  );
}
