"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { LinkTabs } from "@/components/ui/Tabs";
import { MASTER_TABS, type MasterTabId } from "@/lib/master";
import { warehouseApi } from "@/lib/warehouse";

type Counts = Partial<Record<MasterTabId, number>>;

type MasterHeaderProps = {
  active: MasterTabId;
  /** The tab's primary action ("Tambah item"). Omit for read-only users. */
  action?: { label: string; onClick: () => void; disabled?: boolean; reason?: string };
  /** Bump after a save so the badges re-count. */
  refreshKey?: number;
};

/** One "Master data" header for Item, Satuan, Kategori and Pemasok; each tab is its own route. */
export function MasterHeader({ active, action, refreshKey = 0 }: MasterHeaderProps) {
  const [counts, setCounts] = useState<Counts>({});

  useEffect(() => {
    let alive = true;
    void Promise.allSettled([
      warehouseApi.listItems(),
      warehouseApi.listUnits(),
      warehouseApi.listCategories(),
      warehouseApi.listSuppliers(),
    ]).then(([items, units, categories, suppliers]) => {
      if (!alive) return;
      const next: Counts = {};
      if (items.status === "fulfilled") next.items = items.value.length;
      if (units.status === "fulfilled") next.units = units.value.length;
      if (categories.status === "fulfilled") next.categories = categories.value.length;
      if (suppliers.status === "fulfilled") next.suppliers = suppliers.value.length;
      setCounts(next);
    });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  return (
    <>
      <PageHeader
        title="Master data"
        lede="Bahan yang boleh disimpan, diminta dan dipakai di resep."
        actions={
          action ? (
            <Button disabled={action.disabled} onClick={action.onClick}>
              {action.label}
            </Button>
          ) : undefined
        }
        actionsNote={action?.disabled ? action.reason : undefined}
      />
      <LinkTabs
        label="Jenis master"
        items={MASTER_TABS.map((t) => ({
          href: t.href,
          label: t.label,
          count: counts[t.id],
          active: t.id === active,
        }))}
      />
    </>
  );
}
