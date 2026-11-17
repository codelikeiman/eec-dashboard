"use client";

import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AccountForm, ResetPasswordForm } from "@/components/dashboard/account-forms";
import { useSession } from "@/components/dashboard/session";
import { Badge, ErrorState, FormError, LoadingRows, PageHeader } from "@/components/dashboard/ui";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/dashboard/api";
import { dateTimeLabel } from "@/lib/dashboard/format";
import type { Account } from "@/lib/dashboard/types";
import { useApi } from "@/lib/dashboard/use-api";
import { cn } from "@/lib/utils";

type Mode = { kind: "edit" | "password"; account: Account } | { kind: "new" } | null;

export default function UsersPage() {
  const me = useSession();
  const { data, error, loading, reload } = useApi<{ users: Account[] }>("/users");
  const [mode, setMode] = useState<Mode>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function done(message: string) {
    setMode(null);
    setNotice(message);
    reload();
  }

  async function run(message: string, fn: () => Promise<unknown>, success: string) {
    if (!window.confirm(message)) return;
    setActionError(null);
    try {
      await fn();
      done(success);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Gagal menyimpan.");
    }
  }

  const users = [...(data?.users ?? [])].sort((a, b) => (a.role === b.role ? a.fullName.localeCompare(b.fullName) : a.role === "admin" ? -1 : 1));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengguna"
        description="Semua akun yang bisa login ke dashboard, admin maupun guru."
        actions={
          <button type="button" onClick={() => setMode({ kind: "new" })} className={buttonVariants({ size: "sm" })}>
            <Plus aria-hidden="true" />
            Tambah pengguna
          </button>
        }
      />
      {notice ? <p role="status" className="rounded-md border border-forest-ink/40 bg-forest-ink/5 px-3 py-2 text-small font-semibold text-forest-ink">{notice}</p> : null}
      <FormError message={actionError} />
      {error ? <ErrorState message={error.message} onRetry={reload} /> : null}

      {!data && loading ? (
        <LoadingRows />
      ) : data ? (
        <div className="overflow-x-auto rounded-md border border-ink/20">
          <table className="w-full min-w-[46rem] text-small">
            <caption className="sr-only">Daftar pengguna</caption>
            <thead className="bg-paper-2">
              <tr className="label border-b border-ink text-left text-ink-muted">
                <th className="px-3 py-3 font-semibold">Nama</th>
                <th className="px-3 py-3 font-semibold">Peran</th>
                <th className="px-3 py-3 font-semibold">Terakhir login</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === me.id;
                return (
                  <tr key={u.id} className={cn("border-b border-ink/10", !u.isActive && "text-ink-muted")}>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold">{u.fullName}{self ? <span className="ml-2 font-normal text-ink-muted">(kamu)</span> : null}</p>
                      <p className="text-[0.8125rem] text-ink-muted">{u.email}</p>
                    </td>
                    <td className="px-3 py-2.5">{u.role === "admin" ? <Badge>Admin</Badge> : <Badge tone="muted">Guru</Badge>}</td>
                    <td className="px-3 py-2.5 text-ink-muted">{u.lastSignInAt ? dateTimeLabel(u.lastSignInAt) : "Belum pernah"}</td>
                    <td className="px-3 py-2.5">{u.isActive ? "Aktif" : "Nonaktif"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setMode({ kind: "edit", account: u })} aria-label={`Ubah ${u.fullName}`} title="Ubah" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          <Pencil aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => setMode({ kind: "password", account: u })} aria-label={`Ganti password ${u.fullName}`} title="Ganti password" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          <KeyRound aria-hidden="true" />
                        </button>
                        {!self ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                run(
                                  `${u.isActive ? "Nonaktifkan" : "Aktifkan"} akun ${u.fullName}?`,
                                  () => api(`/users/${u.id}`, { method: "PATCH", body: { isActive: !u.isActive } }),
                                  `${u.fullName} ${u.isActive ? "dinonaktifkan" : "aktif lagi"}.`,
                                )
                              }
                              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-28 justify-center", u.isActive && "text-tomato-ink")}
                            >
                              {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                run(
                                  `Hapus akun ${u.fullName} permanen? Murid yang dipegangnya jadi tanpa guru; riwayat pembayaran tetap aman.`,
                                  () => api(`/users/${u.id}`, { method: "DELETE" }),
                                  `Akun ${u.fullName} dihapus.`,
                                )
                              }
                              aria-label={`Hapus ${u.fullName}`}
                              title="Hapus akun"
                              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-tomato-ink")}
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        {mode ? (
          <DialogContent
            title={mode.kind === "new" ? "Tambah pengguna" : mode.kind === "edit" ? `Ubah ${mode.account.fullName}` : `Ganti password ${mode.account.fullName}`}
          >
            {mode.kind === "password" ? (
              <ResetPasswordForm account={mode.account} onDone={done} />
            ) : (
              <AccountForm
                account={mode.kind === "edit" ? mode.account : null}
                endpoint="/users"
                withRole={!(mode.kind === "edit" && mode.account.id === me.id)}
                onDone={done}
              />
            )}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
