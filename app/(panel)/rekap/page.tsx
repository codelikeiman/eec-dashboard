"use client";

import { ChevronLeft, ChevronRight, Download, Target as TargetIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { EmptyState, ErrorState, Field, FormError, inputClass, LoadingRows, PageHeader, StatCard } from "@/components/dashboard/ui";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/dashboard/api";
import { currentPeriod, percent, periodLabel, rupiah } from "@/lib/dashboard/format";
import type { Arrears, MonthlyRecap } from "@/lib/dashboard/types";
import { useApi } from "@/lib/dashboard/use-api";
import { cn } from "@/lib/utils";

type Month = MonthlyRecap["months"][number];

export default function RecapPage() {
  const thisYear = Number(currentPeriod().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const { data, error, reload } = useApi<MonthlyRecap>(`/reports/monthly?year=${year}`);
  const arrears = useApi<Arrears>("/reports/arrears?months=6");
  const [editing, setEditing] = useState<Month | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Rekap & target"
        description="Rekapitulasi uang les per bulan, target, dan tunggakan."
        actions={
          <>
            <div className="flex items-center gap-1 rounded-md border border-ink/30 p-1">
              <button type="button" onClick={() => setYear(year - 1)} aria-label="Tahun sebelumnya" className="grid size-8 cursor-pointer place-items-center rounded-sm hover:bg-paper-2">
                <ChevronLeft aria-hidden="true" className="size-4" />
              </button>
              <span className="w-14 text-center text-small font-semibold tabular" aria-live="polite">{year}</span>
              <button type="button" onClick={() => setYear(year + 1)} disabled={year >= thisYear} aria-label="Tahun berikutnya" className="grid size-8 cursor-pointer place-items-center rounded-sm hover:bg-paper-2 disabled:opacity-30">
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </div>
            <a href={`/api/reports/monthly.csv?year=${year}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download aria-hidden="true" />
              Unduh CSV
            </a>
          </>
        }
      />

      {error ? <ErrorState message={error.message} onRetry={reload} /> : null}
      {!data ? (
        <LoadingRows />
      ) : (
        <>
          <section aria-label={`Total ${year}`} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={`Terkumpul ${year}`} value={rupiah(data.total.collected)} tone="good" />
            <StatCard label="Total tagihan" value={rupiah(data.total.expected)} />
            <StatCard label="Tunggakan" value={rupiah(data.total.outstanding)} tone={data.total.outstanding ? "warn" : "default"} />
            <StatCard
              label="Capaian target"
              value={data.total.target ? percent(data.total.collected / data.total.target) : "—"}
              hint={data.total.target ? `dari ${rupiah(data.total.target)}` : "Belum ada target"}
            />
          </section>

          <div className="overflow-x-auto rounded-md border border-ink/20">
            <table className="w-full min-w-[56rem] text-small">
              <caption className="sr-only">Rekap uang les per bulan, {year}</caption>
              <thead className="bg-paper-2">
                <tr className="label border-b border-ink text-left whitespace-nowrap text-ink-muted">
                  <th className="px-3 py-3 font-semibold">Bulan</th>
                  <th className="px-3 py-3 text-right font-semibold">Murid</th>
                  <th className="px-3 py-3 text-right font-semibold">Tagihan</th>
                  <th className="px-3 py-3 text-right font-semibold">Terkumpul</th>
                  <th className="px-3 py-3 text-right font-semibold">Tunggakan</th>
                  <th className="px-3 py-3 text-right font-semibold">Target</th>
                  <th className="px-3 py-3 font-semibold">Capaian</th>
                  <th className="px-3 py-3 font-semibold">Lunas / belum</th>
                  <th className="px-3 py-3"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => {
                  const empty = m.future || m.students === 0;
                  return (
                  <tr key={m.period} className={cn("border-b border-ink/10", m.future && "text-ink-muted")}>
                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{periodLabel(m.period)}</td>
                    <td className="px-3 py-2.5 text-right tabular">{empty ? "—" : m.students}</td>
                    <td className="px-3 py-2.5 text-right tabular">{empty ? "—" : rupiah(m.expected)}</td>
                    <td className="px-3 py-2.5 text-right tabular">{empty ? "—" : rupiah(m.collected)}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular", !empty && m.outstanding > 0 && "text-tomato-ink")}>{empty ? "—" : rupiah(m.outstanding)}</td>
                    <td className="px-3 py-2.5 text-right tabular">{m.target !== null ? rupiah(m.target) : "—"}</td>
                    <td className="px-3 py-2.5">
                      {m.achievement !== null && !empty ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-paper-3" role="presentation">
                            <div className={cn("h-full rounded-full", m.achievement >= 1 ? "bg-forest-ink" : "bg-tomato")} style={{ width: `${Math.min(m.achievement, 1) * 100}%` }} />
                          </div>
                          <span className="tabular">{percent(m.achievement)}</span>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular">{empty ? "—" : `${m.lunas} / ${m.belum + m.sebagian}`}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button type="button" onClick={() => setEditing(m)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        <TargetIcon aria-hidden="true" />
                        <span>{m.target !== null ? "Ubah target" : "Atur target"}<span className="sr-only"> {periodLabel(m.period)}</span></span>
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink pb-2">
          <h2 className="font-display text-h3">Tunggakan</h2>
          {arrears.data ? (
            <p className="text-small text-ink-muted">
              {periodLabel(arrears.data.from)} – {periodLabel(arrears.data.to)} · total{" "}
              <span className="font-semibold text-tomato-ink">{rupiah(arrears.data.total)}</span>
            </p>
          ) : null}
        </div>
        {arrears.error ? <ErrorState message={arrears.error.message} onRetry={arrears.reload} /> : null}
        {!arrears.data ? (
          <LoadingRows rows={3} />
        ) : arrears.data.students.length === 0 ? (
          <EmptyState title="Tidak ada tunggakan">Semua murid sudah lunas untuk 6 bulan terakhir.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-md border border-ink/20">
            <table className="w-full min-w-[40rem] text-small">
              <caption className="sr-only">Murid dengan tunggakan</caption>
              <thead className="bg-paper-2">
                <tr className="label border-b border-ink text-left text-ink-muted">
                  <th className="px-3 py-3 font-semibold">Murid</th>
                  <th className="px-3 py-3 font-semibold">Kelas</th>
                  <th className="px-3 py-3 font-semibold">Bulan belum lunas</th>
                  <th className="px-3 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {arrears.data.students.map((s) => (
                  <tr key={s.studentId} className="border-b border-ink/10">
                    <td className="px-3 py-2.5 font-semibold">{s.studentName}</td>
                    <td className="px-3 py-2.5">{s.className}</td>
                    <td className="px-3 py-2.5 text-ink-muted">{s.months.map((m) => periodLabel(m.period, true)).join(", ")}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-tomato-ink tabular">{rupiah(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing ? (
          <DialogContent title={`Target ${periodLabel(editing.period)}`} description="Target uang les yang ingin terkumpul bulan ini.">
            <TargetForm
              month={editing}
              onDone={() => {
                setEditing(null);
                reload();
              }}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function TargetForm({ month, onDone }: { month: Month; onDone: () => void }) {
  const [amount, setAmount] = useState(String(month.target ?? (month.expected || "")));
  const [note, setNote] = useState(month.targetNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api(`/reports/targets/${month.period}`, {
        method: "PUT",
        body: { amount: Number(amount.replace(/\D/g, "") || 0), note: note || null },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan.");
      setPending(false);
    }
  }

  async function clear() {
    setPending(true);
    try {
      await api(`/reports/targets/${month.period}`, { method: "DELETE" });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menghapus.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <FormError message={error} />
      <Field id="target" label="Target (Rp)" hint={month.expected ? `Total tagihan bulan ini ${rupiah(month.expected)}.` : undefined}>
        <input id="target" inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
      </Field>
      <Field id="targetNote" label="Catatan (opsional)">
        <input id="targetNote" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Misal: target naik karena ada kelas baru" className={inputClass} />
      </Field>
      <div className="mt-2 flex items-center justify-between gap-3">
        {month.target !== null ? (
          <button type="button" onClick={clear} disabled={pending} className="cursor-pointer text-small font-semibold text-tomato-ink underline underline-offset-4">
            Hapus target
          </button>
        ) : <span />}
        <button type="submit" disabled={pending} className={buttonVariants({ size: "md" })}>
          {pending ? "Menyimpan…" : "Simpan target"}
        </button>
      </div>
    </form>
  );
}
