"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LocationShape } from "@/components/ui/LocationTag";
import { dashboardApi } from "@/lib/dashboard";
import { NAV_GROUPS, isItemActive, type NavItem } from "@/lib/nav";
import { navKeysForRole } from "@/lib/rbac";

type NavCounts = { alerts: number; pendingRequests: number };

/**
 * Sidebar badges. Reads the existing dashboard summary and refreshes on every
 * navigation, so approving a request updates the count when the user lands back
 * on the queue. Failure is silent: a missing badge must never break navigation.
 */
// TODO(api): a lighter GET /nav-counts would avoid loading the full summary here.
function useNavCounts(pathname: string): NavCounts | null {
  const [counts, setCounts] = useState<NavCounts | null>(null);

  useEffect(() => {
    let alive = true;
    dashboardApi
      .summary()
      .then((s) => {
        if (!alive) return;
        setCounts({
          alerts: s.warehouse_low_stock + s.kitchen_low_stock,
          pendingRequests: s.pending_approvals,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  return counts;
}

function badgeCount(item: NavItem, counts: NavCounts | null): number {
  if (!counts || !item.badge) return 0;
  return item.badge === "alerts" ? counts.alerts : counts.pendingRequests;
}

function Marker({ item }: { item: NavItem }) {
  if (item.marker === "warehouse") return <LocationShape location="warehouse" />;
  if (item.marker === "kitchen") return <LocationShape location="kitchen" />;
  return <span className="shell-nav-ring" aria-hidden="true" />;
}

export function AppSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const counts = useNavCounts(pathname);
  // Phones only: the menu is folded behind a button. On wide screens CSS shows it regardless.
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const groups = useMemo(() => {
    const allowed = navKeysForRole(role);
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => allowed.has(item.key)),
    })).filter((group) => group.items.length > 0);
  }, [role]);

  return (
    <aside
      className={open ? "shell-sidebar is-open" : "shell-sidebar"}
      aria-label="Navigasi utama"
    >
      <div className="shell-sidebar-brand">
        <span className="shell-brand-mark" aria-hidden="true">
          DS
        </span>
        <div className="shell-brand-text">
          <span className="shell-brand">Dapoer Sari</span>
          <span className="shell-sidebar-tagline">Inventaris gudang &amp; dapur</span>
        </div>
        <button
          ref={toggleRef}
          type="button"
          className="shell-nav-toggle"
          aria-expanded={open}
          aria-controls="shell-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Tutup menu" : "Menu"}
        </button>
      </div>

      <nav id="shell-nav" className="shell-nav" aria-label="Menu">
        {groups.map((group) => (
          <div key={group.title} className="shell-nav-group">
            <p className="shell-nav-title">{group.title}</p>
            <ul className="shell-nav-list">
              {group.items.map((item) => {
                const active = isItemActive(pathname, search, item);
                const count = badgeCount(item, counts);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={
                        active ? "shell-nav-link is-active" : "shell-nav-link"
                      }
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <Marker item={item} />
                      <span>{item.label}</span>
                      {count > 0 ? (
                        <span
                          className={
                            item.badge === "alerts"
                              ? "shell-nav-badge ds-num is-alert"
                              : "shell-nav-badge ds-num"
                          }
                        >
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
