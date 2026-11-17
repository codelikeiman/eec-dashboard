"use client";

import { useState, type FormEvent } from "react";
import { Field, FormError, inputClass } from "@/components/dashboard/ui";
import { buttonVariants } from "@/components/ui/button";
import { api, ApiError } from "@/lib/dashboard/api";
import type { Account } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

/**
 * Create / edit an account. `endpoint` is /teachers (always guru) or /users
 * (role picker shown).
 */
export function AccountForm({
  account,
  endpoint,
  withRole,
  onDone,
}: {
  account: Account | null;
  endpoint: "/teachers" | "/users";
  withRole: boolean;
  onDone: (message: string) => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") ?? "");
    const phone = String(form.get("phone") ?? "").trim() || null;
    const body: Record<string, unknown> = { fullName, phone };
    if (withRole) body.role = form.get("role");
    if (!account) {
      body.email = form.get("email");
      body.password = form.get("password");
    }
    setPending(true);
    setError(null);
    setFields({});
    try {
      if (account) await api(`${endpoint}/${account.id}`, { method: "PATCH", body });
      else await api(endpoint, { method: "POST", body });
      onDone(account ? `Data ${fullName} tersimpan.` : `Akun ${fullName} dibuat. Berikan email dan password-nya ke yang bersangkutan.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan.");
      if (err instanceof ApiError) setFields(err.fields);
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <FormError message={error} />
      <Field id="fullName" label="Nama lengkap" error={fields.fullName}>
        <input id="fullName" name="fullName" required defaultValue={account?.fullName} autoFocus className={inputClass} />
      </Field>
      {account ? (
        <p className="text-small text-ink-muted">Email: <span className="font-semibold text-ink">{account.email}</span></p>
      ) : (
        <>
          <Field id="email" label="Email (untuk login)" error={fields.email}>
            <input id="email" name="email" type="email" required autoComplete="off" className={inputClass} />
          </Field>
          <Field id="password" label="Password awal" hint="Minimal 8 karakter. Bisa diganti sendiri dari menu Akun saya." error={fields.password}>
            <input id="password" name="password" type="text" required minLength={8} maxLength={72} autoComplete="new-password" className={inputClass} />
          </Field>
        </>
      )}
      <Field id="phone" label="No. WhatsApp (opsional)" error={fields.phone}>
        <input id="phone" name="phone" type="tel" defaultValue={account?.phone ?? ""} className={inputClass} />
      </Field>
      {withRole ? (
        <Field id="role" label="Peran" error={fields.role} hint="Admin bisa mengelola semuanya. Guru hanya melihat daftar muridnya.">
          <select id="role" name="role" defaultValue={account?.role ?? "guru"} className={inputClass}>
            <option value="guru">Guru</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
      ) : null}
      <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "md" }), "mt-2 self-end")}>
        {pending ? "Menyimpan…" : "Simpan"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ account, onDone }: { account: Account; onDone: (message: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api(`/users/${account.id}/password`, { method: "POST", body: { password } });
      onDone(`Password ${account.fullName} sudah diganti.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengganti password.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <FormError message={error} />
      <Field id="newPassword" label="Password baru" hint="Minimal 8 karakter.">
        <input id="newPassword" type="text" required minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "md" }), "mt-2 self-end")}>
        {pending ? "Menyimpan…" : "Ganti password"}
      </button>
    </form>
  );
}
