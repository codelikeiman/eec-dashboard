"use client";

import { Archive, ArchiveRestore, FileUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { EmptyState, ErrorState, Field, FormError, inputClass, LoadingRows, PageHeader } from "@/components/dashboard/ui";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/dashboard/api";
import { dateLabel } from "@/lib/dashboard/format";
import type { ClassItem, Student, Teacher } from "@/lib/dashboard/types";
import { useApi } from "@/lib/dashboard/use-api";
import { cn } from "@/lib/utils";

type Status = "active" | "archived" | "all";

export default function StudentsPage() {
  const [status, setStatus] = useState<Status>("active");
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Student | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const params = new URLSearchParams({ status });
  if (classId) params.set("classId", classId);
  if (teacherId) params.set("teacherId", teacherId);
  const { data, error, loading, reload } = useApi<{ students: Student[] }>(`/students?${params}`);
  const classes = useApi<{ classes: ClassItem[] }>("/classes");
  const teachers = useApi<{ teachers: Teacher[] }>("/teachers");

  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.students ?? []).filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [data, query]);

  async function act(student: Student, action: "archive" | "restore" | "delete") {
    const messages = {
      archive: `Arsipkan ${student.name}? Ia tidak ditagih lagi mulai bulan depan, riwayat pembayarannya tetap tersimpan.`,
      restore: `Aktifkan lagi ${student.name}?`,
      delete: `Hapus ${student.name} PERMANEN beserta seluruh riwayat pembayarannya? Biasanya cukup diarsipkan.`,
    };
    if (!window.confirm(messages[action])) return;
    setActionError(null);
    try {
      await api(action === "delete" ? `/students/${student.id}` : `/students/${student.id}/${action}`, {
        method: action === "delete" ? "DELETE" : "POST",
      });
      setNotice(
        { archive: `${student.name} diarsipkan.`, restore: `${student.name} aktif lagi.`, delete: `${student.name} dihapus.` }[action],
      );
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Gagal menyimpan.");
    }
  }

  const activeTeachers = (teachers.data?.teachers ?? []).filter((t) => t.isActive);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Murid"
        description="Data murid cukup nama, kelas, dan gurunya. Murid yang berhenti diarsipkan agar riwayat pembayarannya tetap ada."
        actions={
          <>
            <button type="button" onClick={() => setImporting(true)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <FileUp aria-hidden="true" />
              Impor
            </button>
            <button type="button" onClick={() => setEditing("new")} className={buttonVariants({ size: "sm" })}>
              <Plus aria-hidden="true" />
              Tambah murid
            </button>
          </>
        }
      />

      <section aria-label="Filter" className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama murid" aria-label="Cari nama murid" className={cn(inputClass, "pl-9")} />
        </div>
        <select aria-label="Status murid" value={status} onChange={(e) => setStatus(e.target.value as Status)} className={cn(inputClass, "w-auto")}>
          <option value="active">Aktif</option>
          <option value="archived">Arsip</option>
          <option value="all">Semua</option>
        </select>
        <select aria-label="Kelas" value={classId} onChange={(e) => setClassId(e.target.value)} className={cn(inputClass, "w-auto")}>
          <option value="">Semua kelas</option>
          {(classes.data?.classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Guru" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={cn(inputClass, "w-auto")}>
          <option value="">Semua guru</option>
          <option value="none">Belum ada guru</option>
          {(teachers.data?.teachers ?? []).map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
        </select>
        <p className="ml-auto text-small text-ink-muted" aria-live="polite">{students.length} murid</p>
      </section>

      {notice ? <p role="status" className="rounded-md border border-forest-ink/40 bg-forest-ink/5 px-3 py-2 text-small font-semibold text-forest-ink">{notice}</p> : null}
      <FormError message={actionError} />
      {error ? <ErrorState message={error.message} onRetry={reload} /> : null}

      {!data && loading ? (
        <LoadingRows />
      ) : data && data.students.length === 0 ? (
        <EmptyState title={status === "archived" ? "Belum ada murid yang diarsipkan" : "Belum ada murid"}>
          {status !== "archived" ? "Tambahkan satu per satu, atau impor dari spreadsheet." : null}
        </EmptyState>
      ) : data ? (
        <div className="overflow-x-auto rounded-md border border-ink/20">
          <table className="w-full min-w-[42rem] text-small">
            <caption className="sr-only">Daftar murid</caption>
            <thead className="bg-paper-2">
              <tr className="label border-b border-ink text-left text-ink-muted">
                <th className="px-3 py-3 font-semibold">Nama</th>
                <th className="px-3 py-3 font-semibold">Kelas</th>
                <th className="px-3 py-3 font-semibold">Guru</th>
                <th className="px-3 py-3 font-semibold">Ditambahkan</th>
                <th className="px-3 py-3"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-ink/10 hover:bg-paper-2/60">
                  <td className="px-3 py-2.5 font-semibold">
                    {s.name}
                    {s.archivedAt ? <span className="ml-2 text-[0.75rem] font-normal text-ink-muted">(arsip sejak {dateLabel(s.archivedAt)})</span> : null}
                  </td>
                  <td className="px-3 py-2.5">{s.className}</td>
                  <td className={cn("px-3 py-2.5", !s.teacherName && "text-tomato-ink")}>{s.teacherName ?? "Belum ada guru"}</td>
                  <td className="px-3 py-2.5 text-ink-muted">{dateLabel(s.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEditing(s)} aria-label={`Ubah ${s.name}`} title="Ubah" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        <Pencil aria-hidden="true" />
                      </button>
                      {s.archivedAt ? (
                        <button type="button" onClick={() => act(s, "restore")} aria-label={`Aktifkan lagi ${s.name}`} title="Aktifkan lagi" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          <ArchiveRestore aria-hidden="true" />
                        </button>
                      ) : (
                        <button type="button" onClick={() => act(s, "archive")} aria-label={`Arsipkan ${s.name}`} title="Arsipkan" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          <Archive aria-hidden="true" />
                        </button>
                      )}
                      <button type="button" onClick={() => act(s, "delete")} aria-label={`Hapus ${s.name}`} title="Hapus permanen" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-tomato-ink")}>
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing ? (
          <DialogContent title={editing === "new" ? "Tambah murid" : `Ubah ${editing.name}`}>
            <StudentForm
              student={editing === "new" ? null : editing}
              classes={(classes.data?.classes ?? []).filter((c) => c.isActive || (editing !== "new" && c.id === editing.classId))}
              teachers={activeTeachers}
              onDone={(message) => {
                setEditing(null);
                setNotice(message);
                reload();
              }}
            />
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={importing} onOpenChange={setImporting}>
        {importing ? (
          <DialogContent title="Impor murid" description="Salin dari Excel / Google Sheets: satu murid per baris — Nama, Kelas, Guru.">
            <ImportForm
              onDone={(message) => {
                setImporting(false);
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

function StudentForm({
  student,
  classes,
  teachers,
  onDone,
}: {
  student: Student | null;
  classes: ClassItem[];
  teachers: Teacher[];
  onDone: (message: string) => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      classId: form.get("classId") || undefined,
      teacherId: form.get("teacherId") || null,
    };
    setPending(true);
    setError(null);
    setFields({});
    try {
      if (student) await api(`/students/${student.id}`, { method: "PATCH", body });
      else await api("/students", { method: "POST", body });
      onDone(student ? `Data ${body.name} tersimpan.` : `${body.name} ditambahkan.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan.");
      if (err instanceof ApiError) setFields(err.fields);
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <FormError message={error} />
      <Field id="name" label="Nama murid" error={fields.name}>
        <input id="name" name="name" required defaultValue={student?.name} autoFocus aria-invalid={fields.name ? true : undefined} className={inputClass} />
      </Field>
      <Field id="classId" label="Kelas" error={fields.classId}>
        <select id="classId" name="classId" required defaultValue={student?.classId ?? ""} aria-invalid={fields.classId ? true : undefined} className={inputClass}>
          <option value="" disabled>Pilih kelas</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field id="teacherId" label="Guru" error={fields.teacherId} hint={teachers.length === 0 ? "Belum ada guru. Tambahkan di menu Guru." : undefined}>
        <select id="teacherId" name="teacherId" defaultValue={student?.teacherId ?? ""} className={inputClass}>
          <option value="">Belum ada guru</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
        </select>
      </Field>
      <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "md" }), "mt-2 self-end")}>
        {pending ? "Menyimpan…" : "Simpan"}
      </button>
    </form>
  );
}

/** Accepts tab- (spreadsheet paste), comma- or semicolon-separated rows. */
function parseRows(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",").map((c) => c.trim()))
    .filter((cells) => !/^nama$/i.test(cells[0] ?? "")) // skip a header row
    .map(([name = "", className = "", teacherName = ""]) => ({ name, className, teacherName }));
}

function ImportForm({ onDone }: { onDone: (message: string) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<{ row: number; message: string }[]>([]);
  const [pending, setPending] = useState(false);
  const rows = parseRows(text);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setRowErrors([]);
    try {
      const result = await api<{ imported: number }>("/students/import", { method: "POST", body: { rows } });
      onDone(`${result.imported} murid berhasil diimpor.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setRowErrors((err.details as { rows?: { row: number; message: string }[] })?.rows ?? []);
      } else setError("Gagal mengimpor.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FormError message={error} />
      {rowErrors.length > 0 ? (
        <ul className="max-h-32 overflow-y-auto text-[0.8125rem] text-tomato-ink">
          {rowErrors.map((r) => <li key={r.row}>Baris {r.row}: {r.message}</li>)}
        </ul>
      ) : null}
      <Field id="csv" label="Data murid" hint="Contoh: Kevin Tanoto, Standard 2, Miss Sari. Nama kelas dan guru harus sama persis dengan yang ada di dashboard; kolom guru boleh kosong.">
        <textarea
          id="csv"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={cn(inputClass, "h-auto py-2 font-mono text-[0.8125rem]")}
          placeholder={"Nama\tKelas\tGuru\nKevin Tanoto\tStandard 2\tMiss Sari"}
        />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <p className="text-small text-ink-muted">{rows.length} baris terbaca</p>
        <button type="submit" disabled={pending || rows.length === 0} className={buttonVariants({ size: "md" })}>
          {pending ? "Mengimpor…" : `Impor ${rows.length || ""} murid`}
        </button>
      </div>
    </form>
  );
}
