"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "@/components/dashboard/session";
import { TrendChart } from "@/components/dashboard/trend-chart";
import {
  EmptyState,
  ErrorState,
  inputClass,
  LoadingRows,
  PageHeader,
  PeriodPicker,
  StatCard,
} from "@/components/dashboard/ui";
import { buttonVariants } from "@/components/ui/button";
import { currentPeriod, dateTimeLabel, percent, periodLabel, rupiah } from "@/lib/dashboard/format";
import type { Activity, Overview, TeacherStudent } from "@/lib/dashboard/types";
import { useApi } from "@/lib/dashboard/use-api";
import { cn } from "@/lib/utils";

export default function DashboardHome() {
  const user = useSession();
  return user.role === "admin" ? <AdminOverview /> : <MyStudents />;
}

// ---------------------------------------------------------------------------
// Admin: Ringkasan
// ---------------------------------------------------------------------------
function AdminOverview() {
  const [period, setPeriod] = useState(currentPeriod());
  const { data, error, reload } = useApi<Overview>(`/reports/overview?period=${period}`);
  const activity = useApi<{ activity: Activity[] }>("/reports/activity?limit=8");

  const t = data?.totals;
  const target = data?.target?.amount ?? null;
  const progress = target ? Math.min((t?.collected ?? 0) / target, 1) : (t?.collectionRate ?? 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Ringkasan"
        description={`Uang les ${periodLabel(period)} — tagihan, yang sudah masuk, dan tunggakan.`}
        actions={<PeriodPicker value={period} onChange={setPeriod} />}
      />

      {error ? <ErrorState message={error.message} onRetry={reload} /> : null}
      {!data || !t ? (
        <LoadingRows rows={4} />
      ) : (
        <>
          <section aria-label="Angka utama" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Terkumpul"
              value={rupiah(t.collected)}
              hint={target ? `${percent(t.collected / target)} dari target` : `${percent(t.collectionRate)} dari tagihan`}
              tone="good"
            >
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-3" role="presentation">
                <div className="h-full rounded-full bg-forest-ink" style={{ width: `${progress * 100}%` }} />
              </div>
            </StatCard>
            <StatCard
              label="Target bulan ini"
              value={target ? rupiah(target) : "Belum diatur"}
              hint={
                <Link href="/rekap" className="underline underline-offset-4 hover:text-ink">
                  {target ? "Ubah target" : "Atur target"}
                </Link>
              }
            />
            <StatCard label="Total tagihan" value={rupiah(t.expected)} hint={`${t.students} murid ditagih`} />
            <StatCard label="Belum masuk" value={rupiah(t.outstanding)} hint={`${t.belum} belum bayar · ${t.sebagian} sebagian`} tone={t.outstanding > 0 ? "warn" : "default"} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="rounded-md border border-ink/20 p-5">
              <h2 className="font-display text-h4">6 bulan terakhir</h2>
              <p className="mb-4 text-small text-ink-muted">Uang les yang terkumpul dibanding tagihan dan target.</p>
              <TrendChart data={data.trend} />
            </div>
            <div className="flex flex-col gap-3 rounded-md border border-ink/20 p-5">
              <h2 className="font-display text-h4">Status pembayaran</h2>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Lunas", value: t.lunas, cls: "text-forest-ink" },
                  { label: "Sebagian", value: t.sebagian, cls: "" },
                  { label: "Belum", value: t.belum, cls: "text-tomato-ink" },
                ].map((s) => (
                  <div key={s.label} className="rounded-md bg-paper-2 py-3">
                    <dt className="label text-ink-muted">{s.label}</dt>
                    <dd className={cn("font-display text-[1.75rem] tabular", s.cls)}>{s.value}</dd>
                  </div>
                ))}
              </dl>
              <dl className="mt-1 grid grid-cols-3 gap-2 border-t border-ink/15 pt-3 text-small">
                <div><dt className="text-ink-muted">Murid aktif</dt><dd className="font-semibold tabular">{data.activeStudents}</dd></div>
                <div><dt className="text-ink-muted">Murid baru</dt><dd className="font-semibold tabular">{data.newStudents}</dd></div>
                <div><dt className="text-ink-muted">Guru aktif</dt><dd className="font-semibold tabular">{data.activeTeachers}</dd></div>
              </dl>
              <Link href={`/pembayaran?period=${period}&status=belum`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-auto justify-between")}>
                Lihat yang belum bayar
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <BreakdownTable title="Per kelas" rows={data.byClass} />
            <BreakdownTable title="Per guru" rows={data.byTeacher} />
          </section>
        </>
      )}

      <section className="rounded-md border border-ink/20 p-5">
        <h2 className="font-display text-h4">Aktivitas terbaru</h2>
        {activity.data && activity.data.activity.length === 0 ? (
          <p className="mt-2 text-small text-ink-muted">Belum ada aktivitas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10">
            {(activity.data?.activity ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 text-small">
                <span>
                  <span className="font-semibold">{a.actorName ?? "Sistem"}</span> {describeActivity(a)}
                </span>
                <time className="text-ink-muted tabular" dateTime={a.createdAt}>{dateTimeLabel(a.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: Overview["byClass"] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-ink/20 p-5">
      <h2 className="font-display text-h4">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-small text-ink-muted">Belum ada data.</p>
      ) : (
        <table className="mt-3 w-full min-w-[26rem] text-small">
          <thead>
            <tr className="label border-b border-ink text-left text-ink-muted">
              <th className="py-2 font-semibold">Nama</th>
              <th className="py-2 text-right font-semibold">Murid</th>
              <th className="py-2 text-right font-semibold">Terkumpul</th>
              <th className="py-2 text-right font-semibold">Tunggakan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id ?? "none"} className="border-b border-ink/10">
                <td className="py-2">{r.name}</td>
                <td className="py-2 text-right tabular">{r.students}</td>
                <td className="py-2 text-right tabular">{rupiah(r.collected)}</td>
                <td className={cn("py-2 text-right tabular", r.outstanding > 0 && "text-tomato-ink")}>{rupiah(r.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function describeActivity(a: Activity): string {
  const d = a.details as Record<string, string | number | null | undefined>;
  const name = (d.student ?? d.name ?? d.fullName ?? "") as string;
  switch (`${a.action}:${a.entity}`) {
    case "record_payment:payment":
      return `mencatat pembayaran ${name} (${periodLabel(String(d.period))}) ${rupiah(Number(d.amountPaid ?? 0))}`;
    case "delete_payment:payment":
      return `membatalkan pembayaran ${name} (${periodLabel(String(d.period))})`;
    case "bulk_payment:payment":
      return `menandai ${d.students} murid lunas (${periodLabel(String(d.period))})`;
    case "set_target:target":
      return `mengatur target ${periodLabel(String(a.entityId))} ${rupiah(Number(d.amount ?? 0))}`;
    case "create:student":
      return `menambah murid ${name}`;
    case "import:student":
      return `mengimpor ${d.count} murid`;
    case "archive:student":
      return `mengarsipkan murid ${name}`;
    case "restore:student":
      return `mengaktifkan lagi murid ${name}`;
    case "delete:student":
      return `menghapus murid ${name}`;
    case "create:account":
      return `membuat akun ${name} (${d.role})`;
    case "delete:account":
      return `menghapus akun ${name}`;
    case "reset_password:account":
      return "mengganti password sebuah akun";
    case "reassign:teacher":
      return `memindahkan ${d.students} murid ke guru lain`;
    default:
      return `${a.action === "create" ? "menambah" : a.action === "delete" ? "menghapus" : "mengubah"} data ${
        { class: "kelas", account: "akun", student: "murid", target: "target" }[a.entity] ?? a.entity
      }`;
  }
}

// ---------------------------------------------------------------------------
// Guru: Murid saya (read-only)
// ---------------------------------------------------------------------------
function MyStudents() {
  const user = useSession();
  const { data, error, reload } = useApi<{ students: TeacherStudent[] }>("/students");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, TeacherStudent[]>();
    for (const s of data?.students ?? []) {
      if (q && !s.name.toLowerCase().includes(q)) continue;
      map.set(s.className, [...(map.get(s.className) ?? []), s]);
    }
    return [...map.entries()];
  }, [data, query]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Murid saya"
        description={`Halo, ${user.fullName}. Ini daftar murid yang kamu ajar.`}
      />
      {error ? <ErrorState message={error.message} onRetry={reload} /> : null}
      {!data ? (
        <LoadingRows />
      ) : data.students.length === 0 ? (
        <EmptyState title="Belum ada murid">Admin belum menghubungkan murid ke akunmu.</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-full max-w-xs">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama murid"
                aria-label="Cari nama murid"
                className={cn(inputClass, "pl-9")}
              />
            </div>
            <p className="text-small text-ink-muted">
              {data.students.length} murid · {new Set(data.students.map((s) => s.className)).size} kelas
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {groups.map(([className, students]) => (
              <section key={className} className="rounded-md border border-ink/20 p-5">
                <h2 className="flex items-baseline justify-between gap-3 border-b border-ink pb-2">
                  <span className="font-display text-h4">{className}</span>
                  <span className="label text-ink-muted">{students.length} murid</span>
                </h2>
                <ol className="mt-2">
                  {students.map((s, i) => (
                    <li key={s.id} className="flex gap-3 border-b border-ink/10 py-2 text-small last:border-0">
                      <span className="w-6 text-ink-muted tabular">{i + 1}.</span>
                      {s.name}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          {groups.length === 0 ? <p className="text-small text-ink-muted">Tidak ada murid dengan nama itu.</p> : null}
        </>
      )}
    </div>
  );
}
