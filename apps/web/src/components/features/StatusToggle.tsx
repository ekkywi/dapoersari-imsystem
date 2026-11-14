"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type StatusToggleProps = {
  active: boolean;
  /** Lowercase noun: "item", "pemasok". */
  noun: string;
  /** What deactivating means, shown before the second click. */
  consequence: string;
  busy: boolean;
  onConfirm: () => void;
};

/** Aktif / Nonaktif with a two-step confirm in place, instead of window.confirm. */
export function StatusToggle({ active, noun, consequence, busy, onConfirm }: StatusToggleProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="ds-status-box">
      <div className="ds-status-row">
        <span>
          Status {noun}:{" "}
          <strong className={active ? "ds-status-active" : "ds-muted-text"}>
            {active ? "Aktif" : "Nonaktif"}
          </strong>
        </span>
        {confirming ? null : (
          <Button
            size="sm"
            variant={active ? "danger" : "secondary"}
            onClick={() => setConfirming(true)}
          >
            {active ? `Nonaktifkan ${noun}` : `Aktifkan ${noun}`}
          </Button>
        )}
      </div>
      {confirming ? (
        <div className="ds-status-confirm" role="group" aria-label={`Konfirmasi ubah status ${noun}`}>
          <span>
            {active ? consequence : `Ini akan bisa dipilih lagi di transaksi baru.`}
          </span>
          <div className="ds-actions-end">
            <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              variant={active ? "danger-solid" : "primary"}
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? "Memproses…" : active ? "Ya, nonaktifkan" : "Ya, aktifkan"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
