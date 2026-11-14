"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { InlineAlert } from "@/components/ui/InlineAlert";

type EntityDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  saving: boolean;
  canSubmit: boolean;
  /** Why the save button is disabled, written where the user is looking. */
  reason: string | null;
  error: string | null;
  children: ReactNode;
};

/** Drawer + form + pinned Batal / Simpan footer, shared by every master-data form. */
export function EntityDrawer({
  open,
  title,
  description,
  onClose,
  onSubmit,
  submitLabel,
  saving,
  canSubmit,
  reason,
  error,
  children,
}: EntityDrawerProps) {
  return (
    <Drawer
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            form="entity-form"
            disabled={!canSubmit || saving}
            aria-describedby={reason ? "entity-reason" : undefined}
          >
            {saving ? "Menyimpan…" : submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="entity-form"
        className="ds-drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit && !saving) onSubmit();
        }}
      >
        {error ? (
          <InlineAlert role="alert" title="Belum tersimpan">
            {error}
          </InlineAlert>
        ) : null}
        {children}
        {reason ? (
          <p id="entity-reason" className="ds-reason">
            {reason}
          </p>
        ) : null}
      </form>
    </Drawer>
  );
}
