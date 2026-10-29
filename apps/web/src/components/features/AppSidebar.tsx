"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NavKey, navKeysForRole } from "@/lib/rbac";

type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  icon: ReactNode;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

function IconLayout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M3.5 9.5h17M9.5 9.5v11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconRuler() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 15.5 15.5 4.5l4 4-11 11-4-4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M8 12l1.5 1.5M11 9l1.5 1.5M14 6l1.5 1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 12.5V5.5A2 2 0 0 1 5.5 3.5h7l8 8-7 7-8-8Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 7.5h10v9h-10zM13.5 10.5h4.2l2.8 3v3h-7v-6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="17.5" r="1.75" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17" cy="17.5" r="1.75" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 12v8.5M12 12 20 8M12 12 4 8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 20.5 8.5 12 13.5 3.5 8.5 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 12.5 12 17.5l8.5-5M3.5 16 12 21l8.5-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 13.5 6.2 5.5h11.6L20 13.5v5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M4 13.5h4.2l1.3 2h5l1.3-2H20"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12.5H7.5A2.5 2.5 0 0 0 5 22"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="6"
        y="5"
        width="12"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M9 5.5V4.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4.5v1"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M9 11h6M9 14.5h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Utama",
    items: [
      { key: "overview", href: "/app", label: "Ringkasan", icon: <IconLayout /> },
      {
        key: "alerts",
        href: "/app/alerts",
        label: "Alert stok",
        icon: <IconTag />,
      },
    ],
  },
  {
    title: "Master",
    items: [
      { key: "units", href: "/app/warehouse/units", label: "Satuan", icon: <IconRuler /> },
      {
        key: "categories",
        href: "/app/warehouse/categories",
        label: "Kategori",
        icon: <IconTag />,
      },
      {
        key: "suppliers",
        href: "/app/warehouse/suppliers",
        label: "Pemasok",
        icon: <IconTruck />,
      },
      { key: "items", href: "/app/warehouse/items", label: "Item", icon: <IconBox /> },
    ],
  },
  {
    title: "Gudang",
    items: [
      {
        key: "stocks",
        href: "/app/warehouse/stocks",
        label: "Stok gudang",
        icon: <IconLayers />,
      },
      {
        key: "stock-ins",
        href: "/app/warehouse/stock-ins",
        label: "Stok masuk",
        icon: <IconInbox />,
      },
      {
        key: "stock-requests-warehouse",
        href: "/app/stock-requests?focus=warehouse",
        label: "Antrian permintaan",
        icon: <IconClipboard />,
      },
      {
        key: "opname-warehouse",
        href: "/app/opnames?focus=warehouse",
        label: "Opname gudang",
        icon: <IconClipboard />,
      },
    ],
  },
  {
    title: "Dapur",
    items: [
      { key: "menus", href: "/app/kitchen/menus", label: "Resep / menu", icon: <IconBook /> },
      {
        key: "kitchen-stocks",
        href: "/app/kitchen/stocks",
        label: "Stok dapur",
        icon: <IconLayers />,
      },
      {
        key: "stock-requests-kitchen",
        href: "/app/stock-requests?focus=kitchen",
        label: "Permintaan stok",
        icon: <IconClipboard />,
      },
      {
        key: "closings",
        href: "/app/kitchen/closings",
        label: "Penutupan menu",
        icon: <IconClipboard />,
      },
      {
        key: "opname-kitchen",
        href: "/app/opnames?focus=kitchen",
        label: "Opname dapur",
        icon: <IconClipboard />,
      },
    ],
  },
  {
    title: "Audit",
    items: [
      {
        key: "history",
        href: "/app/history",
        label: "Riwayat",
        icon: <IconInbox />,
      },
    ],
  },
];

function pathAndFocus(href: string): { path: string; focus: string | null } {
  const [path, qs] = href.split("?");
  if (!qs) return { path, focus: null };
  const focus = new URLSearchParams(qs).get("focus");
  return { path, focus };
}

function isActive(
  pathname: string,
  search: string,
  href: string,
): boolean {
  const { path, focus } = pathAndFocus(href);
  if (path === "/app") {
    return pathname === "/app";
  }
  if (!(pathname === path || pathname.startsWith(`${path}/`))) {
    return false;
  }
  if (focus) {
    const current = new URLSearchParams(search).get("focus");
    return current === focus;
  }
  return true;
}

export function AppSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : "";

  const groups = useMemo(() => {
    const allowed = navKeysForRole(role);
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => allowed.has(item.key)),
    })).filter((group) => group.items.length > 0);
  }, [role]);

  return (
    <aside className="shell-sidebar" aria-label="Navigasi utama">
      <div className="shell-sidebar-brand">
        <span className="shell-brand-mark" aria-hidden />
        <div>
          <p className="shell-brand">Dapoer Sari</p>
          <p className="shell-sidebar-tagline">Inventaris</p>
        </div>
      </div>

      <nav className="shell-nav">
        {groups.map((group) => (
          <div key={group.title} className="shell-nav-group">
            <p className="shell-nav-title">{group.title}</p>
            <ul className="shell-nav-list">
              {group.items.map((item) => {
                const active = isActive(pathname, search, item.href);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={
                        active ? "shell-nav-link is-active" : "shell-nav-link"
                      }
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="shell-nav-icon">{item.icon}</span>
                      <span>{item.label}</span>
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
