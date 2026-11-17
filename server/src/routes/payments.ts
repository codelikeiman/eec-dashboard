import { Router } from "express";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { loadPayments, loadStudents, loadTargets } from "../lib/data.js";
import { check, HttpError, notFound, parse } from "../lib/http.js";
import { buildLedger, totals } from "../lib/ledger.js";
import { currentPeriod, PERIOD_RE, toDate, today } from "../lib/period.js";
import { db } from "../lib/supabase.js";

export const paymentsRouter = Router();

const period = z.string().regex(PERIOD_RE, "Format bulan harus YYYY-MM.");
const method = z.enum(["tunai", "transfer", "qris", "lainnya"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.");

/** Every billable student for a month, with their payment status. */
paymentsRouter.get("/", async (req, res) => {
  const p = parse(z.object({ period: period.optional() }), req.query).period ?? currentPeriod();
  const [students, payments, targets] = await Promise.all([loadStudents(), loadPayments(p, p), loadTargets(p, p)]);
  const lines = buildLedger(students, payments, p);
  res.json({ period: p, lines, totals: totals(lines), target: targets.get(p) ?? null });
});

const upsertSchema = z
  .object({
    amountDue: z.coerce.number().int().min(0).max(100_000_000),
    amountPaid: z.coerce.number().int().min(0, "Jumlah tidak boleh minus.").max(100_000_000),
    paidOn: isoDate.nullable().optional(),
    method: method.nullable().optional(),
    note: z.string().trim().max(300).nullable().optional(),
  })
  .refine((v) => v.amountPaid === 0 || (v.paidOn && v.method), {
    message: "Isi tanggal bayar dan metodenya.",
    path: ["paidOn"],
  });

/** Record (or correct) one student's payment for a month. */
paymentsRouter.put("/:studentId/:period", async (req, res) => {
  const p = parse(period, req.params.period);
  const input = parse(upsertSchema, req.body);
  const { data: student } = await db.from("students").select("id, name").eq("id", req.params.studentId).maybeSingle();
  if (!student) throw notFound("Murid tidak ditemukan.");

  check(
    await db.from("payments").upsert(
      {
        student_id: student.id,
        period: toDate(p),
        amount_due: input.amountDue,
        amount_paid: input.amountPaid,
        paid_on: input.amountPaid > 0 ? input.paidOn : null,
        method: input.amountPaid > 0 ? input.method : null,
        note: input.note || null,
        recorded_by: req.user!.id,
      },
      { onConflict: "student_id,period" },
    ),
  );
  await audit(req, "record_payment", "payment", `${student.id}:${p}`, {
    student: student.name,
    period: p,
    amountDue: input.amountDue,
    amountPaid: input.amountPaid,
    method: input.method ?? null,
  });
  res.status(204).end();
});

/** Undo: removes the record, so the month goes back to "belum bayar". */
paymentsRouter.delete("/:studentId/:period", async (req, res) => {
  const p = parse(period, req.params.period);
  const rows = check(
    await db
      .from("payments")
      .delete()
      .eq("student_id", req.params.studentId)
      .eq("period", toDate(p))
      .select("amount_paid, student:students(name)"),
  );
  if (rows.length === 0) throw notFound("Belum ada catatan pembayaran untuk bulan ini.");
  await audit(req, "delete_payment", "payment", `${req.params.studentId}:${p}`, {
    student: (rows[0].student as unknown as { name: string } | null)?.name,
    period: p,
    amountPaid: rows[0].amount_paid,
  });
  res.status(204).end();
});

/** Mark several students as paid in full for a month (amount = their bill). */
paymentsRouter.post("/bulk", async (req, res) => {
  const input = parse(
    z.object({
      period,
      studentIds: z.array(z.string().uuid()).min(1, "Pilih minimal satu murid.").max(500),
      paidOn: isoDate.optional(),
      method: method.default("tunai"),
    }),
    req.body,
  );
  const [students, payments] = await Promise.all([loadStudents(), loadPayments(input.period, input.period)]);
  const lines = new Map(buildLedger(students, payments, input.period).map((l) => [l.studentId, l]));
  const targets = input.studentIds.map((id) => lines.get(id)).filter((l) => l && l.status !== "lunas");
  if (targets.length === 0) throw new HttpError(400, "Murid yang dipilih sudah lunas semua.");

  check(
    await db.from("payments").upsert(
      targets.map((l) => ({
        student_id: l!.studentId,
        period: toDate(input.period),
        amount_due: l!.amountDue,
        amount_paid: l!.amountDue,
        paid_on: input.paidOn ?? today(),
        method: input.method,
        recorded_by: req.user!.id,
      })),
      { onConflict: "student_id,period" },
    ),
  );
  await audit(req, "bulk_payment", "payment", null, {
    period: input.period,
    students: targets.length,
    total: targets.reduce((sum, l) => sum + l!.amountDue, 0),
  });
  res.json({ updated: targets.length });
});
