import { Router } from "express";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { loadPayments, loadStudents, loadTargets } from "../lib/data.js";
import { check, parse } from "../lib/http.js";
import { arrears, buildLedger, groupTotals, totals } from "../lib/ledger.js";
import { addMonths, currentPeriod, PERIOD_RE, periodOf, periodRange, toDate } from "../lib/period.js";
import { db } from "../lib/supabase.js";

export const reportsRouter = Router();

const period = z.string().regex(PERIOD_RE, "Format bulan harus YYYY-MM.");

/** Ringkasan for one month + a 6-month trend. */
reportsRouter.get("/overview", async (req, res) => {
  const p = parse(z.object({ period: period.optional() }), req.query).period ?? currentPeriod();
  const from = addMonths(p, -5);
  const [students, payments, targets, teacherCount] = await Promise.all([
    loadStudents(),
    loadPayments(from, p),
    loadTargets(from, p),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "guru").eq("is_active", true),
  ]);
  const lines = buildLedger(students, payments, p);

  res.json({
    period: p,
    totals: totals(lines),
    target: targets.get(p) ?? null,
    activeStudents: students.filter((s) => !s.archived_at).length,
    newStudents: students.filter((s) => periodOf(s.created_at) === p).length,
    activeTeachers: teacherCount.count ?? 0,
    byClass: groupTotals(lines, (l) => ({ id: l.classId, name: l.className })),
    byTeacher: groupTotals(lines, (l) => ({ id: l.teacherId, name: l.teacherName ?? "Tanpa guru" })),
    trend: periodRange(from, p).map((month) => {
      const t = totals(buildLedger(students, payments, month));
      return { period: month, expected: t.expected, collected: t.collected, target: targets.get(month)?.amount ?? null };
    }),
  });
});

function yearRecap(year: number, students: Awaited<ReturnType<typeof loadStudents>>, payments: Awaited<ReturnType<typeof loadPayments>>, targets: Awaited<ReturnType<typeof loadTargets>>) {
  const last = year === Number(currentPeriod().slice(0, 4)) ? currentPeriod() : `${year}-12`;
  return periodRange(`${year}-01`, `${year}-12`).map((month) => {
    const t = totals(buildLedger(students, payments, month));
    const target = targets.get(month)?.amount ?? null;
    return {
      period: month,
      future: month > last,
      ...t,
      target,
      targetNote: targets.get(month)?.note ?? null,
      achievement: target ? t.collected / target : null,
    };
  });
}

/** Rekapitulasi per bulan for a whole year. */
reportsRouter.get("/monthly", async (req, res) => {
  const year = parse(z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() }), req.query).year ?? Number(currentPeriod().slice(0, 4));
  const [students, payments, targets] = await Promise.all([
    loadStudents(),
    loadPayments(`${year}-01`, `${year}-12`),
    loadTargets(`${year}-01`, `${year}-12`),
  ]);
  const months = yearRecap(year, students, payments, targets);
  const past = months.filter((m) => !m.future);
  res.json({
    year,
    months,
    total: {
      expected: past.reduce((s, m) => s + m.expected, 0),
      collected: past.reduce((s, m) => s + m.collected, 0),
      outstanding: past.reduce((s, m) => s + m.outstanding, 0),
      target: past.reduce((s, m) => s + (m.target ?? 0), 0),
    },
  });
});

/** Same recap as a spreadsheet-friendly CSV (opens in Excel / Google Sheets). */
reportsRouter.get("/monthly.csv", async (req, res) => {
  const year = parse(z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() }), req.query).year ?? Number(currentPeriod().slice(0, 4));
  const [students, payments, targets] = await Promise.all([
    loadStudents(),
    loadPayments(`${year}-01`, `${year}-12`),
    loadTargets(`${year}-01`, `${year}-12`),
  ]);
  const header = ["Bulan", "Jumlah murid", "Tagihan (Rp)", "Terkumpul (Rp)", "Tunggakan (Rp)", "Target (Rp)", "Capaian target (%)", "Lunas", "Sebagian", "Belum bayar"];
  const rows = yearRecap(year, students, payments, targets)
    .filter((m) => !m.future)
    .map((m) => [m.period, m.students, m.expected, m.collected, m.outstanding, m.target ?? "", m.achievement !== null ? (m.achievement * 100).toFixed(1) : "", m.lunas, m.sebagian, m.belum]);
  const csv = [header, ...rows].map((r) => r.join(";")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="rekap-uang-les-${year}.csv"`);
  res.send(`﻿${csv}`); // BOM so Excel reads UTF-8 correctly
});

/** Tunggakan: students with unpaid months over the last N months. */
reportsRouter.get("/arrears", async (req, res) => {
  const { months } = parse(z.object({ months: z.coerce.number().int().min(1).max(24).default(6) }), req.query);
  const to = currentPeriod();
  const from = addMonths(to, -(months - 1));
  const [students, payments] = await Promise.all([loadStudents(), loadPayments(from, to)]);
  const list = arrears(students, payments, periodRange(from, to));
  res.json({ from, to, students: list, total: list.reduce((s, a) => s + a.total, 0) });
});

// ---------------------------------------------------------------------------
// Target uang les
// ---------------------------------------------------------------------------
reportsRouter.put("/targets/:period", async (req, res) => {
  const p = parse(period, req.params.period);
  const input = parse(
    z.object({
      amount: z.coerce.number().int().min(0, "Target tidak boleh minus.").max(10_000_000_000),
      note: z.string().trim().max(300).nullable().optional(),
    }),
    req.body,
  );
  check(
    await db
      .from("monthly_targets")
      .upsert({ period: toDate(p), amount: input.amount, note: input.note || null, updated_by: req.user!.id, updated_at: new Date().toISOString() }),
  );
  await audit(req, "set_target", "target", p, { amount: input.amount });
  res.status(204).end();
});

reportsRouter.delete("/targets/:period", async (req, res) => {
  const p = parse(period, req.params.period);
  check(await db.from("monthly_targets").delete().eq("period", toDate(p)));
  await audit(req, "delete_target", "target", p);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Aktivitas terbaru
// ---------------------------------------------------------------------------
reportsRouter.get("/activity", async (req, res) => {
  const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }), req.query);
  const rows = check(
    await db
      .from("audit_log")
      .select("id, action, entity, entity_id, details, created_at, actor:profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  res.json({
    activity: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      details: r.details,
      createdAt: r.created_at,
      actorName: (r.actor as unknown as { full_name: string } | null)?.full_name ?? null,
    })),
  });
});
