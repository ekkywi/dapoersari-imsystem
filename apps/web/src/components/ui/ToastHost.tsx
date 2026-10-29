"use client";

import { useEffect, useState } from "react";
import {
  ToastMessage,
  subscribeToasts,
} from "@/lib/toast";

const TTL_MS = 3200;

export function ToastHost() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribeToasts((toast) => {
      setItems((prev) => [...prev, toast]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== toast.id));
      }, TTL_MS);
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="toast-host" aria-live="polite" aria-relevant="additions">
      {items.map((t) => (
        <div
          key={t.id}
          className={
            t.kind === "success" ? "toast toast-success" : "toast toast-error"
          }
          role="status"
        >
          <span className="toast-text">{t.text}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Tutup"
            onClick={() =>
              setItems((prev) => prev.filter((x) => x.id !== t.id))
            }
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
