"use client";

import Link from "next/link";
import type { KeyboardEvent } from "react";

export type TabItem = { id: string; label: string; count?: number };

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name of the tablist, e.g. "Filter status". */
  label: string;
  /** If set, each tab gets `id="{idPrefix}-tab-{id}"` and `aria-controls="{idPrefix}-panel"`. */
  idPrefix?: string;
};

/** Underline tabs with a count badge. Arrow keys move focus and selection. */
export function Tabs({ items, value, onChange, label, idPrefix }: TabsProps) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const idx = items.findIndex((t) => t.id === value);
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % items.length;
    if (e.key === "ArrowLeft") next = (idx - 1 + items.length) % items.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;
    onChange(items[next].id);
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons[next]?.focus();
  }

  return (
    <div className="ds-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${t.id}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel` : undefined}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="ds-tab"
            onClick={() => onChange(t.id)}
          >
            {t.label}
            {t.count !== undefined ? (
              <span className="ds-tab-count ds-num">{t.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type ChipItem = { id: string; label: string; count?: number };

type FilterChipsProps = {
  items: ChipItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
};

/** Single-select filter pills. Each chip is a toggle button (`aria-pressed`). */
export function FilterChips({ items, value, onChange, label }: FilterChipsProps) {
  return (
    <div className="ds-chips" role="group" aria-label={label}>
      {items.map((c) => (
        <button
          key={c.id}
          type="button"
          className="ds-filter-chip"
          aria-pressed={c.id === value}
          onClick={() => onChange(c.id)}
        >
          {c.label}
          {c.count !== undefined ? <span className="ds-num">{c.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export type LinkTabItem = { href: string; label: string; count?: number; active: boolean };

/** Tabs that are real routes: each tab is a link, the current one carries `aria-current="page"`. */
export function LinkTabs({ items, label }: { items: LinkTabItem[]; label: string }) {
  return (
    <nav className="ds-tabs" aria-label={label}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="ds-tab"
          aria-current={t.active ? "page" : undefined}
        >
          {t.label}
          {t.count !== undefined ? <span className="ds-tab-count ds-num">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
