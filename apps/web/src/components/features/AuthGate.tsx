"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/features/AppSidebar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ToastHost } from "@/components/ui/ToastHost";
import { AuthUser, clearSession, getToken, getUser } from "@/lib/auth";
import {
  canAccessOpnames,
  canAccessStockRequests,
  navKeysForRole,
  roleLabel,
  type NavKey,
} from "@/lib/rbac";

/** Logout after this much idle time (no pointer/keyboard activity). */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_CHECK_MS = 30 * 1000;

const PATH_TO_NAV: { prefix: string; key: NavKey }[] = [
  { prefix: "/app/warehouse/units", key: "units" },
  { prefix: "/app/warehouse/categories", key: "categories" },
  { prefix: "/app/warehouse/suppliers", key: "suppliers" },
  { prefix: "/app/warehouse/items", key: "items" },
  { prefix: "/app/warehouse/stocks", key: "stocks" },
  { prefix: "/app/warehouse/stock-ins", key: "stock-ins" },
  { prefix: "/app/kitchen/menus", key: "menus" },
  { prefix: "/app/kitchen/stocks", key: "kitchen-stocks" },
  { prefix: "/app/kitchen/closings", key: "closings" },
  { prefix: "/app/history", key: "history" },
  { prefix: "/app/alerts", key: "alerts" },
  { prefix: "/app", key: "overview" },
];

function canAccessPath(pathname: string, role: string): boolean {
  if (
    pathname === "/app/stock-requests" ||
    pathname.startsWith("/app/stock-requests/")
  ) {
    return canAccessStockRequests(role);
  }
  if (pathname === "/app/opnames" || pathname.startsWith("/app/opnames/")) {
    return canAccessOpnames(role);
  }
  for (const row of PATH_TO_NAV) {
    if (pathname === row.prefix || pathname.startsWith(`${row.prefix}/`)) {
      return navKeysForRole(role).has(row.key);
    }
  }
  return true;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const sessionUser = getUser();
    if (!token || !sessionUser) {
      router.replace("/login");
      return;
    }
    setUser(sessionUser);
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready || !user) return;
    if (!canAccessPath(pathname, user.role)) {
      router.replace("/app");
    }
  }, [ready, user, pathname, router]);

  useEffect(() => {
    if (!ready || !user) return;

    let lastActivity = Date.now();
    const bump = () => {
      lastActivity = Date.now();
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    for (const ev of events) {
      window.addEventListener(ev, bump, { passive: true });
    }

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
        clearSession();
        router.replace("/login");
      }
    }, IDLE_CHECK_MS);

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, bump);
      }
      window.clearInterval(timer);
    };
  }, [ready, user, router]);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="muted">Memuat…</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <Suspense fallback={<aside className="shell-sidebar" aria-hidden />}>
        <AppSidebar role={user.role} />
      </Suspense>
      <div className="shell-body">
        <header className="shell-topbar">
          <div className="shell-meta">
            <span className="shell-meta-name">{user.full_name}</span>
            <span className="badge badge-neutral">{roleLabel(user.role)}</span>
          </div>
          <div className="shell-topbar-actions">
            <ThemeToggle />
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Keluar
            </button>
          </div>
        </header>
        <div className="shell-main">{children}</div>
      </div>
      <ToastHost />
    </div>
  );
}
