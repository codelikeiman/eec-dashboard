"use client";

import { useState, type FormEvent } from "react";
import { useSession } from "@/components/dashboard/session";
import { Field, FormError, inputClass, PageHeader } from "@/components/dashboard/ui";
import { buttonVariants } from "@/components/ui/button";
import { api, ApiError } from "@/lib/dashboard/api";
import { cn } from "@/lib/utils";

export default function AccountPage() {
  const user = useSession();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setError(null);
    setNotice(null);
    setFields({});
    if (form.get("newPassword") !== form.get("confirm")) {
      setFields({ confirm: "Konfirmasi tidak sama dengan password baru." });
      return;
    }
    setPending(true);
    try {
      await api("/auth/password", {
        method: "POST",
        body: { currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") },
      });
      formEl.reset();
      setNotice("Password berhasil diganti.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengganti password.");
      if (err instanceof ApiError) setFields(err.fields);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <PageHeader title="Akun saya" />
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 rounded-md border border-ink/20 p-5 text-small">
        <dt className="text-ink-muted">Nama</dt>
        <dd className="font-semibold">{user.fullName}</dd>
        <dt className="text-ink-muted">Email</dt>
        <dd className="font-semibold break-all">{user.email}</dd>
        <dt className="text-ink-muted">Peran</dt>
        <dd className="font-semibold">{user.role === "admin" ? "Admin" : "Guru"}</dd>
      </dl>
      {user.role === "guru" ? (
        <p className="text-small text-ink-muted">Untuk mengubah nama atau nomor WhatsApp, hubungi admin.</p>
      ) : null}

      <form onSubmit={save} className="flex flex-col gap-4 rounded-md border border-ink/20 p-5">
        <h2 className="font-display text-h4">Ganti password</h2>
        {notice ? <p role="status" className="text-small font-semibold text-forest-ink">{notice}</p> : null}
        <FormError message={error} />
        <Field id="currentPassword" label="Password sekarang" error={fields.currentPassword}>
          <input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" className={inputClass} />
        </Field>
        <Field id="newPassword" label="Password baru" hint="Minimal 8 karakter." error={fields.newPassword}>
          <input id="newPassword" name="newPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={inputClass} />
        </Field>
        <Field id="confirm" label="Ulangi password baru" error={fields.confirm}>
          <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={inputClass} />
        </Field>
        <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "md" }), "self-end")}>
          {pending ? "Menyimpan…" : "Ganti password"}
        </button>
      </form>
    </div>
  );
}
