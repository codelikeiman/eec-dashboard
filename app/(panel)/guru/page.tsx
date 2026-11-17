"use client";

import { ArrowRightLeft, KeyRound, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AccountForm, ResetPasswordForm } from "@/components/dashboard/account-forms";
import { Badge, EmptyState, ErrorState, Field, FormError, inputClass, LoadingRows, PageHeader } from "@/components/dashboard/ui";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/dashboard/api";
import { dateTimeLabel } from "@/lib/dashboard/format";
import type { Teacher } from "@/lib/dashboard/types";
import { useApi } from "@/lib/dashboard/use-api";
import { cn } from "@/lib/utils";

type Mode = { kind: "edit" | "password" | "reassign"; teacher: Teacher } | { kind: "new" } | null;

export default function TeachersPage() {
  const { data, error, loading, reload } = useApi<{ teachers: Teacher[]; unassignedCount: number }>("/teachers");
  const [mode, setMode] = useState<Mode>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function done(message: string) {
    setMode(null);
    setNotice(message);
    reload();
  }

  async function toggleActive(t: Teacher) {
    const verb = t.isActive ? "Nonaktifkan" : "Aktifkan";
    const extra = t.isActive && t.studentCount > 0 ? ` Ia masih memegang ${t.studentCount} murid; pindahkan dulu bila perlu.` : "";
    if (!window.confirm(`${verb} akun ${t.fullName}?${t.isActive ? " Ia tidak bisa login lagi." : ""}${extra}`)) return;
    setActionError(null);
    try {
      await api(`/teachers/${t.id}`, { method: "PATCH", body: { isActive: !t.isActive } });
      done(`${t.fullName} ${t.isActive ? "dinonaktifkan" : "aktif lagi"}.`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Gagal menyimpan.");
    }
  }

  const teachers = data?.teachers ?? [];
  const title =
    mode?.kind === "new" ? "Tambah guru"
    : mode?.kind === "edit" ? `Ubah ${mode.teacher.fullName}`
    : mode?.kind === "password" ? `Ganti password ${mode.teacher.fullName}`
    : mode?.kind === "reassign" ? `Pindahkan murid ${mode.teacher.fullName}`
    : "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Guru"
        description="Akun guru untuk login. Guru hanya bisa melihat daftar murid yang dihubungkan ke akunnya."
        actions={
          <button type="button" onClick={() => setMode({ kind: "new" })} className={buttonVariants({ size: "sm" })}>
            <Plus aria-hidden="true" />
            Tambah guru
          </button>
        }
      />

      {data && data.unassignedCount > 0 ? (
        <p className="rounded-md border border-tomato-ink/40 px-3 py-2 text-small text-tomato-ink">
          {data.unassignedCount} murid aktif belum punya guru.{" "}
          <Link href="/murid" className="font-semibold underline underline-offset-4">Atur di menu Murid</Link>
        </p>
      ) : null}
      {notice ? <p role="status" className="rounded-md border border-forest-ink/40 bg-forest-ink/5 px-3 py-2 text-small font-semibold text-forest-ink">{notice}</p> : null}
      <FormError message={actionError} />
      {error ? <ErrorState message={error.message} onRetry={reload} /> : null}

      {!data && loading ? (
        <LoadingRows />
      ) : data && teachers.length === 0 ? (
        <EmptyState title="Belum ada guru">Buat akun guru, lalu hubungkan murid ke guru tersebut di menu Murid.</EmptyState>
      ) : data ? (
        <div className="overflow-x-auto rounded-md border border-ink/20">
          <table className="w-full min-w-[48rem] text-small">
            <caption className="sr-only">Daftar guru</caption>
            <thead className="bg-paper-2">
              <tr className="label border-b border-ink text-left text-ink-muted">
                <th className="px-3 py-3 font-semibold">Guru</th>
                <th className="px-3 py-3 text-right font-semibold">Murid</th>
                <th className="px-3 py-3 font-semibold">Kelas</th>
                <th className="px-3 py-3 font-semibold">Terakhir login</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className={cn("border-b border-ink/10 align-top", !t.isActive && "text-ink-muted")}>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold">{t.fullName}</p>
                    <p className="text-[0.8125rem] text-ink-muted">{t.email}{t.phone ? ` · ${t.phone}` : ""}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">{t.studentCount}</td>
                  <td className="px-3 py-2.5">{t.classes.length ? t.classes.join(", ") : <span className="text-ink-muted">—</span>}</td>
                  <td className="px-3 py-2.5 text-ink-muted">{t.lastSignInAt ? dateTimeLabel(t.lastSignInAt) : "Belum pernah"}</td>
                  <td className="px-3 py-2.5">{t.isActive ? <Badge>Aktif</Badge> : <Badge tone="muted">Nonaktif</Badge>}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setMode({ kind: "edit", teacher: t })} aria-label={`Ubah ${t.fullName}`} title="Ubah" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        <Pencil aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setMode({ kind: "password", teacher: t })} aria-label={`Ganti password ${t.fullName}`} title="Ganti password" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        <KeyRound aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode({ kind: "reassign", teacher: t })}
                        disabled={t.studentCount === 0}
                        aria-label={`Pindahkan murid ${t.fullName}`}
                        title="Pindahkan semua murid ke guru lain"
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "disabled:opacity-30")}
                      >
                        <ArrowRightLeft aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => toggleActive(t)} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-28 justify-center", t.isActive && "text-tomato-ink")}>
                        {t.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        {mode ? (
          <DialogContent title={title}>
            {mode.kind === "new" || mode.kind === "edit" ? (
              <AccountForm account={mode.kind === "edit" ? mode.teacher : null} endpoint="/teachers" withRole={false} onDone={done} />
            ) : mode.kind === "password" ? (
              <ResetPasswordForm account={mode.teacher} onDone={done} />
            ) : (
              <ReassignForm teacher={mode.teacher} others={teachers.filter((t) => t.id !== mode.teacher.id && t.isActive)} onDone={done} />
            )}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function ReassignForm({ teacher, others, onDone }: { teacher: Teacher; others: Teacher[]; onDone: (message: string) => void }) {
  const [to, setTo] = useState(others[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { moved } = await api<{ moved: number }>(`/teachers/${teacher.id}/reassign`, { method: "POST", body: { toTeacherId: to || null } });
      const target = others.find((t) => t.id === to)?.fullName;
      onDone(`${moved} murid dipindahkan ${target ? `ke ${target}` : "dan sekarang belum punya guru"}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memindahkan.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <p className="text-small text-ink-muted">
        Semua {teacher.studentCount} murid aktif milik {teacher.fullName} akan dipindahkan. Untuk memindahkan satu per satu, ubah gurunya di menu Murid.
      </p>
      <FormError message={error} />
      <Field id="toTeacher" label="Pindahkan ke">
        <select id="toTeacher" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass}>
          {others.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          <option value="">Tanpa guru</option>
        </select>
      </Field>
      <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "md" }), "mt-2 self-end")}>
        {pending ? "Memindahkan…" : "Pindahkan"}
      </button>
    </form>
  );
}
