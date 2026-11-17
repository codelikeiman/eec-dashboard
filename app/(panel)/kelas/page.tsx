"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge, EmptyState, ErrorState, Field, FormError, inputClass, LoadingRows, PageHeader } from "@/components/dashboard/ui";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/dashboard/api";
import { rupiah } from "@/lib/dashboard/format";
import type { ClassItem } from "@/lib/dashboard/types";
import { useApi } from "@/lib/dashboard/use-api";
import { cn } from "@/lib/utils";

export default function ClassesPage() {
  const { data, error, loading, reload } = useApi<{ classes: ClassItem[] }>("/classes");
  const [editing, setEditing] = useState<ClassItem | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(c: ClassItem) {
    if (!window.confirm(`Hapus kelas ${c.name}?`)) return;
    setActionError(null);
    try {
      await api(`/classes/${c.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Gagal menghapus.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kelas & biaya"
        description="Biaya bulanan per kelas. Perubahan biaya berlaku untuk tagihan yang belum dicatat; pembayaran yang sudah tercatat tidak berubah."
        actions={
          <button type="button" onClick={() => setEditing("new")} className={buttonVariants({ size: "sm" })}>
            <Plus aria-hidden="true" />
            Tambah kelas
          </button>
        }
      />
      <FormError message={actionError} />
      {error ? <ErrorState message={error.message} onRetry={reload} /> : null}

      {!data && loading ? (
        <LoadingRows />
      ) : data && data.classes.length === 0 ? (
        <EmptyState title="Belum ada kelas" />
      ) : data ? (
        <div className="overflow-x-auto rounded-md border border-ink/20">
          <table className="w-full min-w-[36rem] text-small">
            <caption className="sr-only">Daftar kelas</caption>
            <thead className="bg-paper-2">
              <tr className="label border-b border-ink text-left text-ink-muted">
                <th className="px-3 py-3 font-semibold">Kelas</th>
                <th className="px-3 py-3 text-right font-semibold">Biaya / bulan</th>
                <th className="px-3 py-3 text-right font-semibold">Murid aktif</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {data.classes.map((c) => (
                <tr key={c.id} className={cn("border-b border-ink/10", !c.isActive && "text-ink-muted")}>
                  <td className="px-3 py-2.5 font-semibold">{c.name}</td>
                  <td className="px-3 py-2.5 text-right tabular">{rupiah(c.monthlyFee)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{c.studentCount}</td>
                  <td className="px-3 py-2.5">{c.isActive ? <Badge>Dibuka</Badge> : <Badge tone="muted">Ditutup</Badge>}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEditing(c)} aria-label={`Ubah ${c.name}`} title="Ubah" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        <Pencil aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(c)}
                        disabled={c.studentCount > 0}
                        aria-label={`Hapus ${c.name}`}
                        title={c.studentCount > 0 ? "Masih ada murid di kelas ini" : "Hapus"}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-tomato-ink disabled:opacity-30")}
                      >
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
          <DialogContent title={editing === "new" ? "Tambah kelas" : `Ubah ${editing.name}`}>
            <ClassForm
              item={editing === "new" ? null : editing}
              nextOrder={(data?.classes.reduce((m, c) => Math.max(m, c.sortOrder), 0) ?? 0) + 10}
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

function ClassForm({ item, nextOrder, onDone }: { item: ClassItem | null; nextOrder: number; onDone: () => void }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      monthlyFee: Number(String(form.get("monthlyFee")).replace(/\D/g, "") || 0),
      sortOrder: Number(form.get("sortOrder") || 0),
      isActive: form.get("isActive") === "on",
    };
    setPending(true);
    setError(null);
    setFields({});
    try {
      if (item) await api(`/classes/${item.id}`, { method: "PATCH", body });
      else await api("/classes", { method: "POST", body });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan.");
      if (err instanceof ApiError) setFields(err.fields);
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <FormError message={error} />
      <Field id="name" label="Nama kelas" error={fields.name}>
        <input id="name" name="name" required defaultValue={item?.name} autoFocus placeholder="Misal: Standard 1" className={inputClass} />
      </Field>
      <Field id="monthlyFee" label="Biaya per bulan (Rp)" error={fields.monthlyFee}>
        <input id="monthlyFee" name="monthlyFee" inputMode="numeric" required defaultValue={item?.monthlyFee} className={inputClass} />
      </Field>
      <Field id="sortOrder" label="Urutan" hint="Angka kecil tampil lebih dulu." error={fields.sortOrder}>
        <input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={item?.sortOrder ?? nextOrder} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-small">
        <input type="checkbox" name="isActive" defaultChecked={item?.isActive ?? true} className="size-4 accent-ink" />
        Kelas dibuka (bisa dipilih untuk murid baru)
      </label>
      <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "md" }), "mt-2 self-end")}>
        {pending ? "Menyimpan…" : "Simpan"}
      </button>
    </form>
  );
}
