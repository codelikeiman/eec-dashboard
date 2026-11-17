/** Shapes returned by the Express API (server/src/routes/*). */

export type Role = "admin" | "guru";
export type SessionUser = { id: string; email: string; fullName: string; role: Role };

export type ClassItem = {
  id: string;
  name: string;
  monthlyFee: number;
  sortOrder: number;
  isActive: boolean;
  studentCount: number;
};

export type Student = {
  id: string;
  name: string;
  classId: string;
  className: string;
  teacherId: string | null;
  teacherName: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type TeacherStudent = { id: string; name: string; classId: string; className: string };

export type Account = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

export type Teacher = Account & { studentCount: number; classes: string[] };

export type PaymentStatus = "lunas" | "sebagian" | "belum";

export type LedgerLine = {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  teacherId: string | null;
  teacherName: string | null;
  archived: boolean;
  period: string;
  amountDue: number;
  amountPaid: number;
  outstanding: number;
  status: PaymentStatus;
  paidOn: string | null;
  method: string | null;
  note: string | null;
  hasRecord: boolean;
};

export type Totals = {
  students: number;
  expected: number;
  collected: number;
  outstanding: number;
  lunas: number;
  sebagian: number;
  belum: number;
  collectionRate: number;
};

export type Target = { amount: number; note: string | null } | null;

export type GroupTotals = Totals & { id: string | null; name: string };

export type Overview = {
  period: string;
  totals: Totals;
  target: Target;
  activeStudents: number;
  newStudents: number;
  activeTeachers: number;
  byClass: GroupTotals[];
  byTeacher: GroupTotals[];
  trend: { period: string; expected: number; collected: number; target: number | null }[];
};

export type MonthlyRecap = {
  year: number;
  months: (Totals & {
    period: string;
    future: boolean;
    target: number | null;
    targetNote: string | null;
    achievement: number | null;
  })[];
  total: { expected: number; collected: number; outstanding: number; target: number };
};

export type Arrears = {
  from: string;
  to: string;
  total: number;
  students: {
    studentId: string;
    studentName: string;
    className: string;
    teacherName: string | null;
    months: { period: string; outstanding: number }[];
    total: number;
  }[];
};

export type Activity = {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  actorName: string | null;
};
