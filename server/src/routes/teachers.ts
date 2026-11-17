import { Router } from "express";
import { z } from "zod";
import { createAccount, listAccounts, updateAccount } from "../lib/accounts.js";
import { audit } from "../lib/audit.js";
import { check, HttpError, parse } from "../lib/http.js";
import { db, selectAll } from "../lib/supabase.js";

/** Manajemen guru: teacher accounts with their students. */
export const teachersRouter = Router();

teachersRouter.get("/", async (_req, res) => {
  const [teachers, students] = await Promise.all([
    listAccounts("guru"),
    selectAll<{ teacher_id: string | null; class: { name: string } | null }>((from, to) =>
      db.from("students").select("teacher_id, class:classes(name)").is("archived_at", null).range(from, to),
    ),
  ]);
  const stats = new Map<string, { count: number; classes: Set<string> }>();
  for (const s of students) {
    if (!s.teacher_id) continue;
    const entry = stats.get(s.teacher_id) ?? { count: 0, classes: new Set<string>() };
    entry.count += 1;
    if (s.class) entry.classes.add(s.class.name);
    stats.set(s.teacher_id, entry);
  }
  res.json({
    teachers: teachers.map((t) => ({
      ...t,
      studentCount: stats.get(t.id)?.count ?? 0,
      classes: [...(stats.get(t.id)?.classes ?? [])].sort(),
    })),
    unassignedCount: students.filter((s) => !s.teacher_id).length,
  });
});

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email belum benar."),
  password: z.string().min(8, "Password minimal 8 karakter.").max(72),
  fullName: z.string().trim().min(2, "Nama minimal 2 huruf.").max(100),
  phone: z.string().trim().max(30).nullable().optional(),
});

teachersRouter.post("/", async (req, res) => {
  const input = parse(createSchema, req.body);
  const id = await createAccount(req, { ...input, role: "guru" });
  res.status(201).json({ id });
});

const updateSchema = z.object({
  fullName: z.string().trim().min(2, "Nama minimal 2 huruf.").max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  isActive: z.boolean().optional(),
});

teachersRouter.patch("/:id", async (req, res) => {
  const { data: profile } = await db.from("profiles").select("role").eq("id", req.params.id).maybeSingle();
  if (profile?.role !== "guru") throw new HttpError(404, "Guru tidak ditemukan.");
  await updateAccount(req, req.params.id, parse(updateSchema, req.body));
  res.status(204).end();
});

/** Move all of a teacher's active students to another teacher (or to none). */
teachersRouter.post("/:id/reassign", async (req, res) => {
  const { toTeacherId } = parse(z.object({ toTeacherId: z.string().uuid().nullable() }), req.body);
  if (toTeacherId === req.params.id) throw new HttpError(400, "Pilih guru yang berbeda.");
  if (toTeacherId) {
    const { data: target } = await db.from("profiles").select("role, is_active").eq("id", toTeacherId).maybeSingle();
    if (target?.role !== "guru" || !target.is_active) throw new HttpError(400, "Guru tujuan tidak valid.");
  }
  const moved = check(
    await db
      .from("students")
      .update({ teacher_id: toTeacherId })
      .eq("teacher_id", req.params.id)
      .is("archived_at", null)
      .select("id"),
  );
  await audit(req, "reassign", "teacher", req.params.id, { toTeacherId, students: moved.length });
  res.json({ moved: moved.length });
});
