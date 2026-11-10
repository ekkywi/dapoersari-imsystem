"use client";

import { useEffect, useState } from "react";

function formatTanggal(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatJam(date: Date) {
  const parts = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const second = parts.find((p) => p.type === "second")?.value ?? "00";
  return `${hour}:${minute}:${second}`;
}

function useNow() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return now;
}

/** Tanggal operasional di blok branding (tanpa jam). */
export function LiveClock({ className = "" }: { className?: string }) {
  const now = useNow();

  return (
    <p className={`entry-clock ${className}`.trim()} suppressHydrationWarning>
      <span className="entry-clock-date">
        {now ? formatTanggal(now) : "—"}
      </span>
    </p>
  );
}

/** Tanggal hidup untuk metrik ringkasan landing. */
export function LiveDate({ className = "" }: { className?: string }) {
  const now = useNow();

  return (
    <p
      className={`stat-value entry-clock-date ${className}`.trim()}
      suppressHydrationWarning
    >
      {now ? formatTanggal(now) : "—"}
    </p>
  );
}

/** Jam hidup untuk kartu ringkasan. */
export function LiveTime({ className = "" }: { className?: string }) {
  const now = useNow();

  return (
    <p className={`stat-value ${className}`.trim()} suppressHydrationWarning>
      {now ? formatJam(now) : "—"}
    </p>
  );
}
