"use client";

import { CheckCheck, Pencil, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type FormEvent } from "react";
import {
  EmptyState,
  ErrorState,
  Field,
  FormError,
  inputClass,
  LoadingRows,
  PageHeader,
  PeriodPicker,
  StatCard,
  StatusBadge,
} from "@/components/dashboard/ui";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/dashboard/api";
import { currentPeriod, dateLabel, methodLabel, periodLabel, rupiah, todayISO } from "@/lib/dashboard/format";
import type { LedgerLine, PaymentStatus, Target, Totals } from "@/lib/dashboard/types";
import { useApi } from "@/lib/dashboard/use-api";
import { cn } from "@/lib/utils";

type Ledger = { period: string; lines: LedgerLine[]; totals: Totals; target: Target };

export default function PaymentsPage() {
  return (
    <Suspense>
      <Payments />
    </Suspense>
  );
}

function Payments() {
  const params = useSearchParams();
  const [period, setPeriod] = useState(params.get("period") ?? currentPeriod());
  const [status, setStatus] = useState<PaymentStatus | "all">((params.get("status") as PaymentStatus) ?? "all");
  const [classId, setClassId] = useState("all");
  const [teacherId, setTeacherId] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<LedgerLine | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, error, loading, reload } = useApi<Ledger>(`/payments?period=${period}`);

  const classes = useMemo(() => uniq(data?.lines.map((l) => [l.classId, l.className] as const) ?? []), [data]);
  const teachers = useMemo(
    () => uniq(data?.lines.map((l) => [l.teacherId ?? "none", l.teacherName ?? "Tanpa guru"] as const) ?? []),
    [data],
  );

  const lines = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.lines ?? []).filter(
      (l) =>
        (status === "all" || l.status === status) &&
        (classId === "all" || l.classId === classId) &&
        (teacherId === "all" || (l.teacherId ?? "none") === teacherId) &&
        (!q || l.studentName.toLowerCase().includes(q)),
    );
  }, [data, status, classId, teacherId, query]);

  const unpaidVisible = lines.filter((l) => l.status !== "lunas");
  const selectedLines = unpaidVisible.filter((l) => selected.has(l.studentId));

  function changePeriod(next: string) {
    setPeriod(next);
    setSelected(new Set());
    setNotice(null);
  }

  async function markPaid(studentIds: string[]) {
    setBusy(true);
    setBulkError(null);
    try {
      const result = await api<{ updated: number }>("/payments/bulk", {
        method: "POST",
        body: { period, studentIds, paidOn: todayISO(), method: "tunai" },
      });
      setNotice(`${result.updated} murid ditandai lunas untuk ${periodLabel(period)}.`);
      setSelected(new Set());
      reload();
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  const t = data?.totals;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pembayaran"
        description="Catat siapa yang sudah dan belum bayar uang les. Tagihan diambil dari biaya kelas masing-masing murid."
        actions={<PeriodPicker value={period} onChange={changePeriod} />}
      />

      {t ? (
        <section aria-label="Ringkasan bulan ini" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Terkumpul" value={rupiah(t.collected)} tone="good" hint={`dari ${rupiah(t.expected)}`} />
          <StatCard label="Belum masuk" value={rupiah(t.outstanding)} tone={t.outstanding ? "warn" : "default"} />
          <StatCard label="Lunas" value={`${t.lunas} / ${t.students}`} hint="murid" />
          <StatCard
            label="Target"
            value={data?.target ? rupiah(data.target.amount) : "—"}
            hint={data?.target ? `${Math.round((t.collected / Math.max(data.target.amount, 1)) * 100)}% tercapai` : "Atur di menu Rekap & target"}
          />
        </section>
      ) : null}

      <section aria-label="Filter" className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama murid" aria-label="Cari nama murid" className={cn(inputClass, "pl-9")} />
        </div>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | "all")} className={cn(inputClass, "w-auto")}>
          <option value="all">Semua status</option>
          <option value="belum">Belum bayar</option>
          <option value="sebagian">Sebagian</option>
          <option value="lunas">Lunas</option>
        </select>
        <select aria-label="Kelas" value={classId} onChange={(e) => setClassId(e.target.value)} className={cn(inputClass, "w-auto")}>
          <option value="all">Semua kelas</option>
          {classes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select aria-label="Guru" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={cn(inputClass, "w-auto")}>
          <option value="all">Semua guru</option>
          {teachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </section>

      {notice ? <p role="status" className="rounded-md border border-forest-ink/40 bg-forest-ink/5 px-3 py-2 text-small font-semibold text-forest-ink">{notice}</p> : null}
      <FormError message={bulkError} />
      {error ? <ErrorState message={error.message} onRetry={reload} /> : null}

      {selectedLines.length > 0 ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-ink bg-paper-2 px-4 py-3">
          <p className="text-small font-semibold">
            {selectedLines.length} murid dipilih · {rupiah(selectedLines.reduce((s, l) => s + l.outstanding, 0))}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSelected(new Set())} className={buttonVariants({ variant: "ghost", size: "sm" })}>Batal</button>
            <button type="button" disabled={busy} onClick={() => markPaid(selectedLines.map((l) => l.studentId))} className={buttonVariants({ size: "sm" })}>
              <CheckCheck aria-hidden="true" />
              Tandai lunas (tunai, hari ini)
            </button>
          </div>
        </div>
      ) : null}

      {!data && loading ? (
        <LoadingRows />
      ) : data && data.lines.length === 0 ? (
        <EmptyState title={`Belum ada murid untuk ${periodLabel(period)}`}>
          Murid ditagih mulai bulan mereka ditambahkan. Tambahkan murid di menu Murid.
        </EmptyState>
      ) : data ? (
        <div className="overflow-x-auto rounded-md border border-ink/20">
          <table className="w-full min-w-[52rem] text-small">
            <caption className="sr-only">Pembayaran uang les {periodLabel(period)}</caption>
            <thead className="bg-paper-2">
              <tr className="label border-b border-ink text-left text-ink-muted">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua yang belum lunas"
                    className="size-4 accent-[var(--tomato)]"
                    checked={unpaidVisible.length > 0 && unpaidVisible.every((l) => selected.has(l.studentId))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(unpaidVisible.map((l) => l.studentId)) : new Set())}
                  />
                </th>
                <th className="px-3 py-3 font-semibold">Murid</th>
                <th className="px-3 py-3 font-semibold">Kelas</th>
                <th className="px-3 py-3 font-semibold">Guru</th>
                <th className="px-3 py-3 text-right font-semibold">Tagihan</th>
                <th className="px-3 py-3 text-right font-semibold">Dibayar</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Tanggal</th>
                <th className="px-3 py-3"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.studentId} className="border-b border-ink/10 hover:bg-paper-2/60">
                  <td className="px-3 py-2.5">
                    {l.status !== "lunas" ? (
                      <input
                        type="checkbox"
                        aria-label={`Pilih ${l.studentName}`}
                        className="size-4 accent-[var(--tomato)]"
                        checked={selected.has(l.studentId)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(l.studentId);
                          else next.delete(l.studentId);
                          setSelected(next);
                        }}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">
                    {l.studentName}
                    {l.archived ? <span className="ml-2 text-[0.75rem] font-normal text-ink-muted">(arsip)</span> : null}
                  </td>
                  <td className="px-3 py-2.5">{l.className}</td>
                  <td className="px-3 py-2.5 text-ink-muted">{l.teacherName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular">{rupiah(l.amountDue)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{l.amountPaid ? rupiah(l.amountPaid) : "—"}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={l.status} /></td>
                  <td className="px-3 py-2.5 text-ink-muted">
                    {l.paidOn ? `${dateLabel(l.paidOn)} · ${methodLabel[l.method ?? ""] ?? ""}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1.5">
                      {l.status !== "lunas" ? (
                        <button type="button" disabled={busy} onClick={() => markPaid([l.studentId])} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Lunas
                        </button>
                      ) : null}
                      <button type="button" onClick={() => setEditing(l)} aria-label={`Catat atau ubah pembayaran ${l.studentName}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        <Pencil aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-ink-muted">Tidak ada murid yang cocok dengan filter.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing ? (
          <DialogContent title={editing.studentName} description={`${editing.className} · ${periodLabel(period)}`}>
            <PaymentForm
              line={editing}
              period={period}
              onDone={(message) => {
                setEditing(null);
                setNotice(message);
                reload();
              }}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function PaymentForm({ line, period, onDone }: { line: LedgerLine; period: string; onDone: (message: string) => void }) {
  const [amountDue, setAmountDue] = useState(String(line.amountDue));
  const [amountPaid, setAmountPaid] = useState(String(line.hasRecord ? line.amountPaid : line.amountDue));
  const [paidOn, setPaidOn] = useState(line.paidOn ?? todayISO());
  const [method, setMethod] = useState(line.method ?? "tunai");
  const [note, setNote] = useState(line.note ?? "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const path = `/payments/${line.studentId}/${period}`;

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFields({});
    try {
      await api(path, {
        method: "PUT",
        body: {
          amountDue: Number(amountDue.replace(/\D/g, "") || 0),
          amountPaid: Number(amountPaid.replace(/\D/g, "") || 0),
          paidOn,
          method,
          note: note || null,
        },
      });
      onDone(`Pembayaran ${line.studentName} untuk ${periodLabel(period)} tersimpan.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan.");
      if (err instanceof ApiError) setFields(err.fields);
      setPending(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Hapus catatan pembayaran ${line.studentName} untuk ${periodLabel(period)}? Statusnya kembali "belum bayar".`)) return;
    setPending(true);
    try {
      await api(path, { method: "DELETE" });
      onDone(`Catatan pembayaran ${line.studentName} dihapus.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menghapus.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="amountDue" label="Tagihan (Rp)" hint="Ubah jika ada potongan." error={fields.amountDue}>
          <input id="amountDue" inputMode="numeric" value={amountDue} onChange={(e) => setAmountDue(e.target.value)} className={inputClass} />
        </Field>
        <Field id="amountPaid" label="Dibayar (Rp)" hint="Isi kurang dari tagihan untuk cicilan." error={fields.amountPaid}>
          <input id="amountPaid" inputMode="numeric" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className={inputClass} />
        </Field>
        <Field id="paidOn" label="Tanggal bayar" error={fields.paidOn}>
          <input id="paidOn" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} />
        </Field>
        <Field id="method" label="Metode" error={fields.method}>
          <select id="method" value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
            {Object.entries(methodLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
      </div>
      <Field id="note" label="Catatan (opsional)" error={fields.note}>
        <input id="note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Misal: dibayar ayahnya, sisa minggu depan" className={inputClass} />
      </Field>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        {line.hasRecord ? (
          <button type="button" onClick={remove} disabled={pending} className="cursor-pointer text-small font-semibold text-tomato-ink underline underline-offset-4">
            Hapus catatan
          </button>
        ) : <span />}
        <button type="submit" disabled={pending} className={buttonVariants({ size: "md" })}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </form>
  );
}

function uniq(pairs: readonly (readonly [string, string])[]) {
  return [...new Map(pairs).entries()].sort((a, b) => a[1].localeCompare(b[1], "id"));
}
