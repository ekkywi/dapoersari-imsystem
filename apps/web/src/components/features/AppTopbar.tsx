"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { AuthUser } from "@/lib/auth";
import { findDetailCrumb, findNavMatch } from "@/lib/nav";
import { roleLabel } from "@/lib/rbac";

function Breadcrumb() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const match = findNavMatch(pathname, search);
  const detail = findDetailCrumb(pathname);

  return (
    <nav className="shell-crumbs" aria-label="Lokasi halaman">
      <ol>
        {match ? (
          <>
            <li>{match.group}</li>
            <li aria-hidden="true">/</li>
            {detail ? (
              <>
                <li>
                  <Link href={match.href}>{match.label}</Link>
                </li>
                <li aria-hidden="true">/</li>
                <li
                  className={`shell-crumb-current${detail.mono ? " ds-num" : ""}`}
                  aria-current="page"
                >
                  {detail.label}
                </li>
              </>
            ) : (
              <li className="shell-crumb-current" aria-current="page">
                {match.label}
              </li>
            )}
          </>
        ) : (
          <li className="shell-crumb-current" aria-current="page">
            Dapoer Sari
          </li>
        )}
      </ol>
    </nav>
  );
}

export function AppTopbar({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  return (
    <header className="shell-topbar">
      <Breadcrumb />
      <div className="shell-topbar-actions">
        <span className="shell-meta-name">{user.full_name}</span>
        <span className="shell-role">{roleLabel(user.role)}</span>
        <ThemeToggle />
        <Button variant="secondary" onClick={onLogout}>
          Keluar
        </Button>
      </div>
    </header>
  );
}
