import type { Metadata } from "next";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { LoginForm } from "@/components/dashboard/login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Wordmark className="text-[1.5rem]" />
        <p className="label mt-3 border-t border-ink pt-3 text-ink-muted">Dashboard uang les &amp; data murid</p>
        <h1 className="mt-8 font-display text-h2">Masuk</h1>
        <p className="mt-2 text-small text-ink-muted">Untuk admin dan guru. Akun dibuatkan oleh admin.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
