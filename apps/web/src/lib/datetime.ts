const pad = (n: number) => String(n).padStart(2, "0");

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** `30/10 09:02` — compact, for tables and the document trail. */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `Jumat, 30 Okt 2026` */
export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** `09:02` */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `dd/MM/yyyy HH:mm:ss` — the long form the printed documents already use. */
export function formatFullStamp(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** "48 menit lalu", "2 jam lalu", "Hari ini", "Kemarin", "3 hari lalu". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 6) return `${hours} jam lalu`;
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (dayDiff <= 0) return "Hari ini";
  if (dayDiff === 1) return "Kemarin";
  return `${dayDiff} hari lalu`;
}

/** Local calendar date as `YYYY-MM-DD` (what `<input type="date">` and the API use). */
export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * `Kamis, 29 Okt` for a `YYYY-MM-DD` string; the year is added when it is not the current one.
 * Parsed as a local date on purpose: `new Date("2026-10-29")` is UTC midnight and can read as the day before.
 */
export function formatDateOnly(ymd: string, now: Date = new Date()): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    ...(y !== now.getFullYear() ? { year: "numeric" as const } : {}),
  }).format(date);
}

/** `09:58` today, `Kmr 15:10` yesterday, `28 Okt` before that. For "recent" lists. */
export function formatRecent(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (dayDiff <= 0) return formatClock(iso);
  if (dayDiff === 1) return `Kmr ${formatClock(iso)}`;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d);
}

/**
 * Expiry dates are stored as UTC midnight (`2026-11-12T00:00:00Z`), so the calendar date is
 * read from the UTC parts. Local parts would show the day before in zones behind UTC.
 */
function utcDateParts(iso: string): [number, number, number] {
  const d = new Date(iso);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
}

/** `12/11/2026` for a stored expiry date. */
export function formatExpiry(iso: string): string {
  const [y, m, d] = utcDateParts(iso);
  return `${pad(d)}/${pad(m + 1)}/${y}`;
}

/** Whole calendar days from today to the expiry date; negative = already past. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const [y, m, d] = utcDateParts(iso);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m, d) - today) / 86400000);
}

/** `Jumat, 30 Oktober 2026` — the page kicker on Ringkasan. */
export function formatDateLong(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Midnight of today (local), as epoch ms. */
export function startOfToday(now: Date = new Date()): number {
  return startOfDay(now);
}
