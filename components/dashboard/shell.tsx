"use client";

import {
  BarChart3,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { api } from "@/lib/dashboard/api";
import type { Role, SessionUser } from "@/lib/dashboard/types";
import { useApi } from "@/lib/dashboard/use-api";
import { cn } from "@/lib/utils";
import { SessionProvider } from "./session";
import { ErrorState } from "./ui";

type NavItem = { href: string; label: string; icon: typeof Wallet; roles: Role[] };

const nav: NavItem[] = [
  { href: "/", label: "Ringkasan", icon: LayoutDashboard, roles: ["admin"] },
  { href: "/", label: "Murid saya", icon: GraduationCap, roles: ["guru"] },
  { href: "/pembayaran", label: "Pembayaran", icon: Wallet, roles: ["admin"] },
  { href: "/rekap", label: "Rekap & target", icon: BarChart3, roles: ["admin"] },
  { href: "/murid", label: "Murid", icon: GraduationCap, roles: ["admin"] },
  { href: "/kelas", label: "Kelas & biaya", icon: BookOpen, roles: ["admin"] },
  { href: "/guru", label: "Guru", icon: Users, roles: ["admin"] },
  { href: "/pengguna", label: "Pengguna", icon: ShieldCheck, roles: ["admin"] },
  { href: "/akun", label: "Akun saya", icon: UserRound, roles: ["admin", "guru"] },
];

/** Pages a teacher may open; everything else is admin-only. */
const teacherPaths = ["/", "/akun"];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, error, reload } = useApi<{ user: SessionUser }>("/auth/me");

  if (error) {
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorState message={error.message} onRetry={reload} />
      </div>
    );
  }
  if (!data) {
    return (
      <div aria-busy="true" className="grid min-h-dvh place-items-center text-small text-ink-muted">
        Memuat dashboard…
      </div>
    );
  }

  const user = data.user;
  const items = nav.filter((item) => item.roles.includes(user.role));
  const allowed = user.role === "admin" || teacherPaths.includes(pathname);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  return (
    <SessionProvider user={user}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="border-b border-ink/20 bg-paper-2 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block lg:px-6 lg:py-6">
            <Link href="/" className="block">
              <Wordmark withCourse={false} className="text-[1.25rem]" />
              <span className="label mt-1 block text-ink-muted">Dashboard</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-ink/30 px-3 py-2 text-small font-semibold lg:hidden"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Keluar
            </button>
          </div>

          <nav aria-label="Menu dashboard" className="overflow-x-auto px-3 pb-3 lg:flex-1 lg:overflow-visible lg:pb-0">
            <ul className="flex gap-1 lg:flex-col">
              {items.map((item) => {
                const active = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-small font-semibold whitespace-nowrap transition-colors",
                        active ? "bg-ink text-paper" : "text-ink hover:bg-paper-3",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="hidden border-t border-ink/15 px-6 py-5 lg:block">
            <p className="text-small font-semibold">{user.fullName}</p>
            <p className="truncate text-[0.8125rem] text-ink-muted">
              {user.role === "admin" ? "Admin" : "Guru"} · {user.email}
            </p>
            <button
              type="button"
              onClick={logout}
              className="mt-3 inline-flex cursor-pointer items-center gap-2 text-small font-semibold hover:text-tomato-ink"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Keluar
            </button>
          </div>
        </aside>

        <main id="main" className="min-w-0 px-5 py-6 sm:px-8 lg:px-10 lg:py-9">
          {allowed ? (
            children
          ) : (
            <ErrorState message="Halaman ini khusus admin. Kamu bisa melihat daftar muridmu di menu Murid saya." />
          )}
        </main>
      </div>
    </SessionProvider>
  );
}
