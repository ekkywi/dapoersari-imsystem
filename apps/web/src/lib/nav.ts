import { docNo } from "@/lib/format";
import type { NavKey } from "@/lib/rbac";

/** Marker next to a nav link: ■ gudang, ● dapur, ring for everything else. */
export type NavMarker = "warehouse" | "kitchen" | "neutral";

export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  marker: NavMarker;
  /** Which sidebar count badge this link shows, if any. */
  badge?: "alerts" | "pending-requests";
  /** Other route prefixes that keep this link highlighted (tabs that live under one menu entry). */
  match?: string[];
  /** Breadcrumb label when the menu label is too long for it. */
  crumb?: string;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Utama",
    items: [
      { key: "overview", href: "/app", label: "Ringkasan", marker: "neutral" },
      {
        key: "alerts",
        href: "/app/alerts",
        label: "Peringatan persediaan",
        marker: "neutral",
        badge: "alerts",
      },
    ],
  },
  {
    title: "Gudang",
    items: [
      {
        key: "stocks",
        href: "/app/warehouse/stocks",
        label: "Persediaan gudang",
        marker: "warehouse",
      },
      {
        key: "stock-ins",
        href: "/app/warehouse/stock-ins",
        label: "Persediaan masuk",
        marker: "warehouse",
      },
      {
        key: "stock-requests-warehouse",
        href: "/app/stock-requests?focus=warehouse",
        label: "Antrian permintaan",
        marker: "warehouse",
        badge: "pending-requests",
      },
      {
        key: "opname-warehouse",
        href: "/app/opnames?focus=warehouse",
        label: "Opname gudang",
        marker: "warehouse",
      },
    ],
  },
  {
    title: "Dapur",
    items: [
      {
        key: "kitchen-stocks",
        href: "/app/kitchen/stocks",
        label: "Persediaan dapur",
        marker: "kitchen",
      },
      {
        key: "stock-requests-kitchen",
        href: "/app/stock-requests?focus=kitchen",
        label: "Permintaan persediaan",
        marker: "kitchen",
      },
      {
        key: "closings",
        href: "/app/kitchen/closings",
        label: "Akhir shift",
        marker: "kitchen",
      },
      {
        key: "opname-kitchen",
        href: "/app/opnames?focus=kitchen",
        label: "Opname dapur",
        marker: "kitchen",
      },
      {
        key: "menus",
        href: "/app/kitchen/menus",
        label: "Resep / menu",
        marker: "kitchen",
      },
    ],
  },
  {
    title: "Master & audit",
    items: [
      {
        key: "items",
        href: "/app/warehouse/items",
        label: "Item, satuan, kategori, pemasok",
        crumb: "Master data",
        marker: "neutral",
        match: ["/app/warehouse/units", "/app/warehouse/categories", "/app/warehouse/suppliers"],
      },
      { key: "history", href: "/app/history", label: "Riwayat", marker: "neutral" },
    ],
  },
  {
    title: "Administrasi",
    items: [
      {
        key: "users",
        href: "/app/admin/users",
        label: "Pengguna",
        marker: "neutral",
      },
    ],
  },
];

function splitHref(href: string): { path: string; focus: string | null } {
  const [path, qs] = href.split("?");
  if (!qs) return { path, focus: null };
  return { path, focus: new URLSearchParams(qs).get("focus") };
}

function pathMatches(pathname: string, path: string): boolean {
  if (path === "/app") return pathname === "/app";
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Same matching the sidebar always used: path prefix, plus `?focus=` when the link has one. */
export function isNavActive(
  pathname: string,
  search: string,
  href: string,
): boolean {
  const { path, focus } = splitHref(href);
  if (!pathMatches(pathname, path)) return false;
  if (focus) return new URLSearchParams(search).get("focus") === focus;
  return true;
}

/** Active when the link's own route matches, or any of its `match` prefixes. */
export function isItemActive(pathname: string, search: string, item: NavItem): boolean {
  if (isNavActive(pathname, search, item.href)) return true;
  return (item.match ?? []).some((path) => pathMatches(pathname, path));
}

export type NavMatch = { group: string; label: string; href: string };

/**
 * Breadcrumb source. Exact door match first; if the page has no `?focus=` (e.g. a
 * detail page opened from a link), fall back to the first link with the same path.
 */
export function findNavMatch(pathname: string, search: string): NavMatch | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isItemActive(pathname, search, item)) {
        return { group: group.title, label: item.crumb ?? item.label, href: item.href };
      }
    }
  }
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathMatches(pathname, splitHref(item.href).path)) {
        return { group: group.title, label: item.crumb ?? item.label, href: item.href };
      }
    }
  }
  return null;
}

export type DetailCrumb = { label: string; mono: boolean };

const MASTER_CRUMBS: Record<string, string> = {
  items: "Item",
  units: "Satuan",
  categories: "Kategori",
  suppliers: "Pemasok",
};

/**
 * Third breadcrumb level for document pages: `/app/stock-requests/<id>` → PRM-…,
 * `/app/stock-requests/new` → "Ajukan permintaan". Null on list pages.
 */
export function findDetailCrumb(pathname: string): DetailCrumb | null {
  const [root, section, third, fourth] = pathname.split("/").filter(Boolean);
  if (root !== "app") return null;
  if (section === "stock-requests" && third) {
    return third === "new"
      ? { label: "Ajukan permintaan", mono: false }
      : { label: docNo("PRM", third), mono: true };
  }
  if (section === "opnames" && third) {
    return third === "new"
      ? { label: "Lembar hitung", mono: false }
      : { label: docNo("OPN", third), mono: true };
  }
  if (section === "warehouse" && third === "stock-ins" && fourth) {
    return { label: docNo("SIN", fourth), mono: true };
  }
  if (section === "warehouse" && third && MASTER_CRUMBS[third]) {
    return { label: MASTER_CRUMBS[third], mono: false };
  }
  return null;
}
