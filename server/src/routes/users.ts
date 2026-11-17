import { Router } from "express";
import { z } from "zod";
import { createAccount, deleteAccount, listAccounts, setPassword, updateAccount } from "../lib/accounts.js";
import { parse } from "../lib/http.js";

/** Manajemen user: every login account (admins and teachers). */
export const usersRouter = Router();

const name = z.string().trim().min(2, "Nama minimal 2 huruf.").max(100);
const phone = z.string().trim().max(30).nullable().optional();
const password = z.string().min(8, "Password minimal 8 karakter.").max(72, "Password maksimal 72 karakter.");

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email belum benar."),
  password,
  fullName: name,
  role: z.enum(["admin", "guru"], { message: "Pilih peran: admin atau guru." }),
  phone,
});

const updateSchema = z.object({
  fullName: name.optional(),
  role: z.enum(["admin", "guru"]).optional(),
  phone,
  isActive: z.boolean().optional(),
});

usersRouter.get("/", async (_req, res) => {
  res.json({ users: await listAccounts() });
});

usersRouter.post("/", async (req, res) => {
  const input = parse(createSchema, req.body);
  const id = await createAccount(req, input);
  res.status(201).json({ id });
});

usersRouter.patch("/:id", async (req, res) => {
  await updateAccount(req, req.params.id, parse(updateSchema, req.body));
  res.status(204).end();
});

usersRouter.post("/:id/password", async (req, res) => {
  const input = parse(z.object({ password }), req.body);
  await setPassword(req, req.params.id, input.password);
  res.status(204).end();
});

usersRouter.delete("/:id", async (req, res) => {
  await deleteAccount(req, req.params.id);
  res.status(204).end();
});
