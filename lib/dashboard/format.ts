const rupiahFormat = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export const rupiah = (amount: number) => rupiahFormat.format(amount);

/** "Rp 12,5 jt" — compact form for chart labels and tight cards. */
export function rupiahShort(amount: number) {
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  }
  if (amount >= 1_000) return `Rp ${Math.round(amount / 1_000)} rb`;
  return rupiah(amount);
}

export const percent = (ratio: number) =>
  `${(ratio * 100).toLocaleString("id-ID", { maximumFractionDigits: 0 })}%`;

const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "2026-11" → "November 2026" */
export function periodLabel(period: string, short = false) {
  const [year, month] = period.split("-").map(Number);
  const name = monthNames[month - 1];
  return short ? `${name.slice(0, 3)} ${String(year).slice(2)}` : `${name} ${year}`;
}

/** Current month in WIB, "YYYY-MM". */
export function currentPeriod() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export function addMonths(period: string, delta: number) {
  const [year, month] = period.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function dateLabel(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function dateTimeLabel(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const methodLabel: Record<string, string> = {
  tunai: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
  lainnya: "Lainnya",
};
