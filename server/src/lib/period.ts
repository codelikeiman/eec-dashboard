/**
 * A billing period is a calendar month. The API speaks "YYYY-MM"; the
 * database stores the first day of the month ("YYYY-MM-01").
 * Months are computed in Asia/Jakarta time (WIB), the school's time zone.
 */

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export type Period = string; // "YYYY-MM"

export function toDate(period: Period): string {
  return `${period}-01`;
}

export function fromDate(date: string): Period {
  return date.slice(0, 7);
}

/** Month of a timestamp, in WIB. */
export function periodOf(timestamp: string | Date): Period {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

export function currentPeriod(now = new Date()): Period {
  return periodOf(now);
}

/** Today's date in WIB, "YYYY-MM-DD". */
export function today(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

export function addMonths(period: Period, delta: number): Period {
  const [year, month] = period.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Inclusive list of periods from → to. */
export function periodRange(from: Period, to: Period): Period[] {
  const out: Period[] = [];
  for (let p = from; p <= to; p = addMonths(p, 1)) out.push(p);
  return out;
}
