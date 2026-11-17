"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { api, ApiError } from "@/lib/dashboard/api";
import { cn } from "@/lib/utils";
import { Field, FormError, inputClass } from "./ui";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setFields({});
    try {
      await api("/auth/login", {
        method: "POST",
        body: { email: form.get("email"), password: form.get("password") },
      });
      // Only same-site paths: "/murid" yes, "//evil.com" or "/\evil.com" no.
      const next = params.get("next");
      router.replace(next && /^\/(?![/\\])/.test(next) ? next : "/");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields);
      } else {
        setError("Tidak bisa terhubung ke server.");
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
      <FormError message={error} />
      <Field id="email" label="Email" error={fields.email}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          aria-invalid={fields.email ? true : undefined}
          aria-describedby={fields.email ? "email-error" : undefined}
          className={inputClass}
        />
      </Field>
      <Field id="password" label="Password" error={fields.password}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={fields.password ? true : undefined}
          aria-describedby={fields.password ? "password-error" : undefined}
          className={inputClass}
        />
      </Field>
      <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "lg" }), "justify-between")}>
        {pending ? "Memeriksa…" : "Masuk"}
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ArrowRight aria-hidden="true" />}
      </button>
      <p className="text-small text-ink-muted">Lupa password? Minta admin untuk menggantinya dari menu Pengguna.</p>
    </form>
  );
}
