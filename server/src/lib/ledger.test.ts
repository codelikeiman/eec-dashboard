import assert from "node:assert/strict";
import { test } from "node:test";
import { arrears, buildLedger, statusOf, totals, type PaymentRecord, type StudentRecord } from "./ledger.js";
import { addMonths, periodOf, periodRange } from "./period.js";

const kg = { id: "c1", name: "Kindergarten 1", monthly_fee: 200_000 };
const pt = { id: "c2", name: "Pre-TOEFL", monthly_fee: 300_000 };

const student = (over: Partial<StudentRecord>): StudentRecord => ({
  id: "s1",
  name: "Kevin",
  class_id: kg.id,
  teacher_id: "t1",
  archived_at: null,
  created_at: "2026-09-10T03:00:00Z",
  class: kg,
  teacher: { id: "t1", full_name: "Miss Sari" },
  ...over,
});

const pay = (over: Partial<PaymentRecord>): PaymentRecord => ({
  student_id: "s1",
  period: "2026-10-01",
  amount_due: 200_000,
  amount_paid: 200_000,
  paid_on: "2026-10-03",
  method: "tunai",
  note: null,
  ...over,
});

test("status rules", () => {
  assert.equal(statusOf(200_000, 200_000), "lunas");
  assert.equal(statusOf(200_000, 250_000), "lunas");
  assert.equal(statusOf(200_000, 50_000), "sebagian");
  assert.equal(statusOf(200_000, 0), "belum");
  assert.equal(statusOf(0, 0), "lunas");
});

test("periods: WIB month boundary and arithmetic", () => {
  // 31 Oct 2026 20:00 UTC is already 1 Nov in Jakarta (UTC+7).
  assert.equal(periodOf("2026-10-31T20:00:00Z"), "2026-11");
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.deepEqual(periodRange("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
});

test("billing starts the month a student is added and stops after archiving", () => {
  const students = [
    student({ id: "a", created_at: "2026-10-15T00:00:00Z" }),
    student({ id: "b", created_at: "2026-09-01T00:00:00Z", archived_at: "2026-10-20T00:00:00Z" }),
  ];
  const ids = (p: string) => buildLedger(students, [], p).map((l) => l.studentId).sort();
  assert.deepEqual(ids("2026-09"), ["b"]);
  assert.deepEqual(ids("2026-10"), ["a", "b"]); // archived in October: still billed for October
  assert.deepEqual(ids("2026-11"), ["a"]);
});

test("a recorded payment always shows, with its snapshot amount", () => {
  const students = [student({ created_at: "2026-11-01T00:00:00Z" })];
  // Recorded for September although the student was added in November (back-payment).
  const lines = buildLedger(students, [pay({ period: "2026-09-01", amount_due: 180_000, amount_paid: 180_000 })], "2026-09");
  assert.equal(lines.length, 1);
  assert.equal(lines[0].amountDue, 180_000);
  assert.equal(lines[0].status, "lunas");
});

test("unpaid months use the class's current fee", () => {
  const lines = buildLedger([student({ class_id: pt.id, class: pt })], [], "2026-10");
  assert.equal(lines[0].amountDue, 300_000);
  assert.equal(lines[0].status, "belum");
  assert.equal(lines[0].hasRecord, false);
});

test("totals and collection rate", () => {
  const students = [
    student({ id: "s1" }),
    student({ id: "s2", name: "Nadia" }),
    student({ id: "s3", name: "Putri", class_id: pt.id, class: pt }),
  ];
  const payments = [pay({ student_id: "s1" }), pay({ student_id: "s2", amount_paid: 50_000 })];
  const t = totals(buildLedger(students, payments, "2026-10"));
  assert.equal(t.students, 3);
  assert.equal(t.expected, 700_000);
  assert.equal(t.collected, 250_000);
  assert.equal(t.outstanding, 450_000);
  assert.deepEqual([t.lunas, t.sebagian, t.belum], [1, 1, 1]);
  assert.ok(Math.abs(t.collectionRate - 250 / 700) < 1e-9);
});

test("arrears across months, biggest first", () => {
  const students = [student({ id: "s1" }), student({ id: "s2", name: "Nadia", class_id: pt.id, class: pt })];
  const payments = [pay({ student_id: "s1", period: "2026-09-01" }), pay({ student_id: "s1", period: "2026-10-01", amount_paid: 150_000 })];
  const list = arrears(students, payments, periodRange("2026-09", "2026-10"));
  assert.deepEqual(list.map((a) => [a.studentId, a.total]), [["s2", 600_000], ["s1", 50_000]]);
  assert.deepEqual(list[1].months, [{ period: "2026-10", outstanding: 50_000 }]);
});
