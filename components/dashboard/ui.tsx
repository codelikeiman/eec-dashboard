"use client";

import { ChevronLeft, ChevronRight, CircleAlert, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import type { PaymentStatus } from "@/lib/dashboard/types";
import { addMonths, currentPeriod, periodLabel } from "@/lib/dashboard/format";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-ink pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[clamp(1.75rem,1.4rem+1.2vw,2.5rem)] leading-tight">{title}</h1>
        {description ? <p className="mt-1.5 max-w-[60ch] text-small text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "warn";
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-ink/20 bg-paper p-4 sm:p-5">
      <p className="label text-ink-muted">{label}</p>
      <p
        className={cn(
          "font-display text-[1.75rem] leading-none tabular",
          tone === "good" && "text-forest-ink",
          tone === "warn" && "text-tomato-ink",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-small text-ink-muted">{hint}</p> : null}
      {children}
    </div>
  );
}

const statusStyle: Record<PaymentStatus, { label: string; className: string }> = {
  lunas: { label: "Lunas", className: "border-forest-ink/40 bg-forest-ink/10 text-forest-ink" },
  sebagian: { label: "Sebagian", className: "border-ink/30 bg-paper-3 text-ink" },
  belum: { label: "Belum bayar", className: "border-tomato-ink/40 bg-tomato-ink/10 text-tomato-ink" },
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const s = statusStyle[status];
  return (
    <span className={cn("inline-flex items-center rounded-sm border px-2 py-0.5 text-[0.75rem] font-semibold whitespace-nowrap", s.className)}>
      {s.label}
    </span>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "muted" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[0.75rem] font-semibold whitespace-nowrap",
        tone === "default" && "border-ink/30 bg-paper-2",
        tone === "muted" && "border-ink/15 text-ink-muted",
        tone === "warn" && "border-tomato-ink/40 text-tomato-ink",
      )}
    >
      {children}
    </span>
  );
}

/** ‹ November 2026 › — never goes past next month. */
export function PeriodPicker({ value, onChange }: { value: string; onChange: (period: string) => void }) {
  const max = addMonths(currentPeriod(), 1);
  return (
    <div className="flex items-center gap-1 rounded-md border border-ink/30 bg-paper p-1">
      <button
        type="button"
        onClick={() => onChange(addMonths(value, -1))}
        aria-label="Bulan sebelumnya"
        className="grid size-8 cursor-pointer place-items-center rounded-sm hover:bg-paper-2"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>
      <input
        type="month"
        value={value}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label="Pilih bulan"
        className="h-8 w-[10.5rem] rounded-sm bg-transparent px-1 text-center text-small font-semibold"
      />
      <button
        type="button"
        onClick={() => onChange(addMonths(value, 1))}
        disabled={value >= max}
        aria-label="Bulan berikutnya"
        className="grid size-8 cursor-pointer place-items-center rounded-sm hover:bg-paper-2 disabled:cursor-default disabled:opacity-30"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
      <span className="sr-only" aria-live="polite">
        {periodLabel(value)}
      </span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-ink/25 px-6 py-12 text-center">
      <Inbox aria-hidden="true" className="size-6 text-ink-muted" strokeWidth={1.5} />
      <p className="font-display text-h4">{title}</p>
      {children ? <div className="max-w-[46ch] text-small text-ink-muted">{children}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-tomato-ink/40 bg-tomato-ink/5 px-4 py-3 text-small">
      <CircleAlert aria-hidden="true" className="size-4 text-tomato-ink" />
      <span className="font-semibold text-tomato-ink">{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="cursor-pointer font-semibold underline underline-offset-4">
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}

export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Memuat data" className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-sm bg-paper-2" />
      ))}
    </div>
  );
}

/** Label + control + error message, wired for screen readers. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-small font-semibold">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-[0.8125rem] text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-[0.8125rem] font-medium text-tomato-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Boxed input styling for dense admin forms (the public site uses underlines). */
export const inputClass =
  "h-11 w-full rounded-md border border-ink/40 bg-paper px-3 text-[0.9375rem] text-ink placeholder:text-ink-muted/70 hover:border-ink focus-visible:outline-offset-1 aria-invalid:border-tomato-ink disabled:opacity-60";

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-tomato-ink/40 bg-tomato-ink/5 px-3 py-2 text-small font-medium text-tomato-ink">
      {message}
    </p>
  );
}
