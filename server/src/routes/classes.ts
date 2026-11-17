import { Router } from "express";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { check, HttpError, notFound, parse } from "../lib/http.js";
import { db } from "../lib/supabase.js";

export const classesRouter = Router();

const classSchema = z.object({
  name: z.string().trim().min(1, "Nama kelas wajib diisi.").max(60),
  monthlyFee: z.coerce.number().int("Biaya harus angka bulat.").min(0, "Biaya tidak boleh minus.").max(100_000_000),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

const toRow = (c: z.infer<typeof classSchema>) => ({
  name: c.name,
  monthly_fee: c.monthlyFee,
  ...(c.sortOrder !== undefined ? { sort_order: c.sortOrder } : {}),
  ...(c.isActive !== undefined ? { is_active: c.isActive } : {}),
});

classesRouter.get("/", async (_req, res) => {
  const classes = check(
    await db
      .from("classes")
      .select("id, name, monthly_fee, sort_order, is_active, students(count)")
      .is("students.archived_at", null)
      .order("sort_order")
      .order("name"),
  );
  res.json({
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      monthlyFee: c.monthly_fee,
      sortOrder: c.sort_order,
      isActive: c.is_active,
      studentCount: (c.students as unknown as { count: number }[])[0]?.count ?? 0,
    })),
  });
});

classesRouter.post("/", async (req, res) => {
  const input = parse(classSchema, req.body);
  const row = check(await db.from("classes").insert(toRow(input)).select("id").single());
  await audit(req, "create", "class", row.id, { name: input.name, monthlyFee: input.monthlyFee });
  res.status(201).json({ id: row.id });
});

classesRouter.patch("/:id", async (req, res) => {
  const input = parse(classSchema.partial(), req.body);
  const update = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.monthlyFee !== undefined ? { monthly_fee: input.monthlyFee } : {}),
    ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
  };
  const rows = check(await db.from("classes").update(update).eq("id", req.params.id).select("id"));
  if (rows.length === 0) throw notFound("Kelas tidak ditemukan.");
  await audit(req, "update", "class", req.params.id, input);
  res.status(204).end();
});

classesRouter.delete("/:id", async (req, res) => {
  const { count } = await db
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("class_id", req.params.id);
  if (count) {
    throw new HttpError(409, `Kelas ini masih dipakai ${count} murid. Pindahkan muridnya dulu, atau nonaktifkan kelasnya.`);
  }
  const rows = check(await db.from("classes").delete().eq("id", req.params.id).select("id, name"));
  if (rows.length === 0) throw notFound("Kelas tidak ditemukan.");
  await audit(req, "delete", "class", req.params.id, { name: rows[0].name });
  res.status(204).end();
});
