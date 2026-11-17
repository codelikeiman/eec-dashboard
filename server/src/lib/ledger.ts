import { fromDate, periodOf, type Period } from "./period.js";

/**
 * Pure bookkeeping logic (no database access), so it can be unit-tested.
 *
 * Rules
 * - A student is billed for a month if they were added on/before that month and
 *   were not archived before it. A month with a recorded payment always counts.
 * - The amount due is the snapshot stored with the payment, or — for months
 *   without a record yet — the class's current monthly fee.
 * - Status: "lunas" (paid in full), "sebagian" (partly paid), "belum" (unpaid).
 */

export type StudentRecord = {
  id: string;
  name: string;
  class_id: string;
  teacher_id: string | null;
  archived_at: string | null;
  created_at: string;
  class: { id: string; name: string; monthly_fee: number } | null;
  teacher: { id: string; full_name: string } | null;
};

export type PaymentRecord = {
  student_id: string;
  period: string; // YYYY-MM-01
  amount_due: number;
  amount_paid: number;
  paid_on: string | null;
  method: string | null;
  note: string | null;
  updated_at?: string;
};

export type PaymentStatus = "lunas" | "sebagian" | "belum";

export type LedgerLine = {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  teacherId: string | null;
  teacherName: string | null;
  archived: boolean;
  period: Period;
  amountDue: number;
  amountPaid: number;
  outstanding: number;
  status: PaymentStatus;
  paidOn: string | null;
  method: string | null;
  note: string | null;
  hasRecord: boolean;
};

export function statusOf(amountDue: number, amountPaid: number): PaymentStatus {
  if (amountPaid >= amountDue) return "lunas";
  if (amountPaid > 0) return "sebagian";
  return "belum";
}

export function isBillable(student: StudentRecord, period: Period): boolean {
  if (periodOf(student.created_at) > period) return false;
  if (student.archived_at && periodOf(student.archived_at) < period) return false;
  return true;
}

/** All billing lines for one month. */
export function buildLedger(
  students: StudentRecord[],
  payments: PaymentRecord[],
  period: Period,
): LedgerLine[] {
  const byStudent = new Map<string, PaymentRecord>();
  for (const p of payments) if (fromDate(p.period) === period) byStudent.set(p.student_id, p);

  const lines: LedgerLine[] = [];
  for (const s of students) {
    const record = byStudent.get(s.id);
    if (!record && !isBillable(s, period)) continue;
    const amountDue = record ? record.amount_due : (s.class?.monthly_fee ?? 0);
    const amountPaid = record?.amount_paid ?? 0;
    lines.push({
      studentId: s.id,
      studentName: s.name,
      classId: s.class_id,
      className: s.class?.name ?? "—",
      teacherId: s.teacher_id,
      teacherName: s.teacher?.full_name ?? null,
      archived: Boolean(s.archived_at),
      period,
      amountDue,
      amountPaid,
      outstanding: Math.max(amountDue - amountPaid, 0),
      status: statusOf(amountDue, amountPaid),
      paidOn: record?.paid_on ?? null,
      method: record?.method ?? null,
      note: record?.note ?? null,
      hasRecord: Boolean(record),
    });
  }
  return lines.sort(
    (a, b) => a.className.localeCompare(b.className, "id") || a.studentName.localeCompare(b.studentName, "id"),
  );
}

export type Totals = {
  students: number;
  expected: number;
  collected: number;
  outstanding: number;
  lunas: number;
  sebagian: number;
  belum: number;
  /** Share of the expected amount that has been collected, 0–1. */
  collectionRate: number;
};

export function totals(lines: LedgerLine[]): Totals {
  const t = { students: lines.length, expected: 0, collected: 0, outstanding: 0, lunas: 0, sebagian: 0, belum: 0 };
  for (const line of lines) {
    t.expected += line.amountDue;
    // Overpayment never counts towards another student's bill.
    t.collected += line.amountPaid;
    t.outstanding += line.outstanding;
    t[line.status] += 1;
  }
  return { ...t, collectionRate: t.expected > 0 ? Math.min(t.collected / t.expected, 1) : 0 };
}

/** Group lines by a key (class or teacher) with totals per group. */
export function groupTotals(
  lines: LedgerLine[],
  key: (line: LedgerLine) => { id: string | null; name: string },
) {
  const groups = new Map<string, { id: string | null; name: string; lines: LedgerLine[] }>();
  for (const line of lines) {
    const k = key(line);
    const id = k.id ?? "none";
    if (!groups.has(id)) groups.set(id, { id: k.id, name: k.name, lines: [] });
    groups.get(id)!.lines.push(line);
  }
  return [...groups.values()]
    .map((g) => ({ id: g.id, name: g.name, ...totals(g.lines) }))
    .sort((a, b) => b.expected - a.expected);
}

export type Arrear = {
  studentId: string;
  studentName: string;
  className: string;
  teacherName: string | null;
  months: { period: Period; outstanding: number }[];
  total: number;
};

/** Students with unpaid or partly paid months between `from` and `to`. */
export function arrears(
  students: StudentRecord[],
  payments: PaymentRecord[],
  periods: Period[],
): Arrear[] {
  const map = new Map<string, Arrear>();
  for (const period of periods) {
    for (const line of buildLedger(students, payments, period)) {
      if (line.outstanding <= 0) continue;
      const entry = map.get(line.studentId) ?? {
        studentId: line.studentId,
        studentName: line.studentName,
        className: line.className,
        teacherName: line.teacherName,
        months: [],
        total: 0,
      };
      entry.months.push({ period, outstanding: line.outstanding });
      entry.total += line.outstanding;
      map.set(line.studentId, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
