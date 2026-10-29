"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AuthUser, clearSession, getToken, getUser } from "@/lib/auth";

function roleLabel(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin_gudang":
      return "Admin Gudang";
    case "admin_kitchen":
      return "Admin Dapur";
    default:
      return role.replaceAll("_", " ");
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
      <header className="shell-topbar">
        <div className="shell-brand-block">
          <span className="shell-brand-mark" aria-hidden />
          <div>
            <p className="shell-brand">Dapoer Sari</p>
            <div className="shell-meta">
              <span className="shell-meta-name">{user.full_name}</span>
              <span className="badge badge-neutral">{roleLabel(user.role)}</span>
            </div>
          </div>
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
  );
}
