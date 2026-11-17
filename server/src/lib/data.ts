import type { PaymentRecord, StudentRecord } from "./ledger.js";
import { toDate, type Period } from "./period.js";
import { db, selectAll } from "./supabase.js";

const STUDENT_COLUMNS =
  "id, name, class_id, teacher_id, archived_at, created_at, class:classes(id, name, monthly_fee), teacher:profiles(id, full_name)";

/** Every student (archived ones too — they matter for past months). */
export function loadStudents(): Promise<StudentRecord[]> {
  return selectAll<StudentRecord>((from, to) =>
    db.from("students").select(STUDENT_COLUMNS).order("name").range(from, to),
  );
}

export function loadPayments(from: Period, to: Period): Promise<PaymentRecord[]> {
  return selectAll<PaymentRecord>((start, end) =>
    db
      .from("payments")
      .select("student_id, period, amount_due, amount_paid, paid_on, method, note, updated_at")
      .gte("period", toDate(from))
      .lte("period", toDate(to))
      .order("period")
      .range(start, end),
  );
}

export async function loadTargets(from: Period, to: Period): Promise<Map<Period, { amount: number; note: string | null }>> {
  const { data, error } = await db
    .from("monthly_targets")
    .select("period, amount, note")
    .gte("period", toDate(from))
    .lte("period", toDate(to));
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((t) => [t.period.slice(0, 7), { amount: t.amount, note: t.note }]));
}
