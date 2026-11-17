import { Router } from "express";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { check, HttpError, notFound, parse } from "../lib/http.js";
import { db, selectAll } from "../lib/supabase.js";
import { requireRole } from "../middleware/auth.js";

export const studentsRouter = Router();

type StudentRow = {
  id: string;
  name: string;
  class_id: string;
  teacher_id: string | null;
  archived_at: string | null;
  created_at: string;
  class: { id: string; name: string; sort_order: number } | null;
  teacher: { id: string; full_name: string } | null;
};

const listQuery = z.object({
  status: z.enum(["active", "archived", "all"]).default("active"),
  classId: z.string().uuid().optional(),
  teacherId: z.union([z.string().uuid(), z.literal("none")]).optional(),
  search: z.string().trim().max(100).optional(),
});

/**
 * Admin: every student, filterable.
 * Guru: only their own active students, and only name + class
 * (teachers don't see payments or other teachers' students).
 */
studentsRouter.get("/", async (req, res) => {
  const user = req.user!;
  const q = parse(listQuery, req.query);

  const rows = await selectAll<StudentRow>((from, to) => {
    let query = db
      .from("students")
      .select(
        "id, name, class_id, teacher_id, archived_at, created_at, class:classes(id, name, sort_order), teacher:profiles(id, full_name)",
      )
      .order("name")
      .range(from, to);
    if (user.role === "guru") {
      query = query.eq("teacher_id", user.id).is("archived_at", null);
    } else {
      if (q.status === "active") query = query.is("archived_at", null);
      if (q.status === "archived") query = query.not("archived_at", "is", null);
      if (q.classId) query = query.eq("class_id", q.classId);
      if (q.teacherId === "none") query = query.is("teacher_id", null);
      else if (q.teacherId) query = query.eq("teacher_id", q.teacherId);
    }
    if (q.search) query = query.ilike("name", `%${q.search.replace(/[%_\\]/g, "\\$&")}%`);
    return query;
  });

  const sorted = rows.sort(
    (a, b) =>
      (a.class?.sort_order ?? 0) - (b.class?.sort_order ?? 0) || a.name.localeCompare(b.name, "id"),
  );

  if (user.role === "guru") {
    res.json({
      students: sorted.map((s) => ({ id: s.id, name: s.name, classId: s.class_id, className: s.class?.name ?? "—" })),
    });
    return;
  }
  res.json({
    students: sorted.map((s) => ({
      id: s.id,
      name: s.name,
      classId: s.class_id,
      className: s.class?.name ?? "—",
      teacherId: s.teacher_id,
      teacherName: s.teacher?.full_name ?? null,
      archivedAt: s.archived_at,
      createdAt: s.created_at,
    })),
  });
});

const studentSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 huruf.").max(100),
  classId: z.string({ message: "Pilih kelas." }).uuid("Pilih kelas."),
  teacherId: z.string().uuid().nullable().optional(),
});

async function assertTeacher(teacherId: string | null | undefined) {
  if (!teacherId) return;
  const { data } = await db.from("profiles").select("role, is_active").eq("id", teacherId).maybeSingle();
  if (data?.role !== "guru" || !data.is_active) {
    throw new HttpError(400, "Guru yang dipilih tidak valid.", { fields: { teacherId: "Pilih guru yang aktif." } });
  }
}

const admin = requireRole("admin");

studentsRouter.post("/", admin, async (req, res) => {
  const input = parse(studentSchema, req.body);
  await assertTeacher(input.teacherId);
  const row = check(
    await db
      .from("students")
      .insert({ name: input.name, class_id: input.classId, teacher_id: input.teacherId ?? null })
      .select("id")
      .single(),
  );
  await audit(req, "create", "student", row.id, { name: input.name });
  res.status(201).json({ id: row.id });
});

/** Bulk import, e.g. from a spreadsheet: rows matched to classes/teachers by name. */
const importSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(100),
        className: z.string().trim().min(1).max(60),
        teacherName: z.string().trim().max(100).optional().default(""),
      }),
    )
    .min(1, "Tidak ada baris untuk diimpor.")
    .max(1000, "Maksimal 1000 baris sekali impor."),
});

studentsRouter.post("/import", admin, async (req, res) => {
  const { rows } = parse(importSchema, req.body);
  const [classes, teachers] = await Promise.all([
    db.from("classes").select("id, name"),
    db.from("profiles").select("id, full_name").eq("role", "guru").eq("is_active", true),
  ]);
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const classByName = new Map((check(classes) ?? []).map((c) => [norm(c.name), c.id]));
  const teacherByName = new Map((check(teachers) ?? []).map((t) => [norm(t.full_name), t.id]));

  const errors: { row: number; message: string }[] = [];
  const inserts: { name: string; class_id: string; teacher_id: string | null }[] = [];
  rows.forEach((r, i) => {
    const classId = classByName.get(norm(r.className));
    const teacherId = r.teacherName ? teacherByName.get(norm(r.teacherName)) : null;
    if (!classId) errors.push({ row: i + 1, message: `Kelas "${r.className}" tidak ditemukan.` });
    else if (r.teacherName && !teacherId) errors.push({ row: i + 1, message: `Guru "${r.teacherName}" tidak ditemukan.` });
    else inserts.push({ name: r.name, class_id: classId, teacher_id: teacherId ?? null });
  });
  // All or nothing: fix the file and import again.
  if (errors.length > 0) throw new HttpError(400, "Ada baris yang belum cocok. Tidak ada data yang disimpan.", { rows: errors });

  check(await db.from("students").insert(inserts));
  await audit(req, "import", "student", null, { count: inserts.length });
  res.status(201).json({ imported: inserts.length });
});

studentsRouter.patch("/:id", admin, async (req, res) => {
  const input = parse(studentSchema.partial(), req.body);
  if (input.teacherId !== undefined) await assertTeacher(input.teacherId);
  const update = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.classId !== undefined ? { class_id: input.classId } : {}),
    ...(input.teacherId !== undefined ? { teacher_id: input.teacherId } : {}),
  };
  const rows = check(await db.from("students").update(update).eq("id", req.params.id).select("id"));
  if (rows.length === 0) throw notFound("Murid tidak ditemukan.");
  await audit(req, "update", "student", req.params.id, input);
  res.status(204).end();
});

studentsRouter.post("/:id/archive", admin, async (req, res) => {
  const rows = check(
    await db.from("students").update({ archived_at: new Date().toISOString() }).eq("id", req.params.id).is("archived_at", null).select("id, name"),
  );
  if (rows.length === 0) throw notFound("Murid tidak ditemukan atau sudah diarsipkan.");
  await audit(req, "archive", "student", req.params.id, { name: rows[0].name });
  res.status(204).end();
});

studentsRouter.post("/:id/restore", admin, async (req, res) => {
  const rows = check(
    await db.from("students").update({ archived_at: null }).eq("id", req.params.id).select("id, name"),
  );
  if (rows.length === 0) throw notFound("Murid tidak ditemukan.");
  await audit(req, "restore", "student", req.params.id, { name: rows[0].name });
  res.status(204).end();
});

/** Permanent delete — also removes the student's payment history. */
studentsRouter.delete("/:id", admin, async (req, res) => {
  const rows = check(await db.from("students").delete().eq("id", req.params.id).select("id, name"));
  if (rows.length === 0) throw notFound("Murid tidak ditemukan.");
  await audit(req, "delete", "student", req.params.id, { name: rows[0].name });
  res.status(204).end();
});
