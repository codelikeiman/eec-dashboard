import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { HttpError, parse } from "../lib/http.js";
import { authClient, db } from "../lib/supabase.js";
import {
  accessToken,
  authenticate,
  clearSessionCookies,
  loadProfile,
  setSessionCookies,
} from "../middleware/auth.js";

export const authRouter = Router();

// Slow down password guessing: 10 attempts per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan masuk. Coba lagi 15 menit lagi." },
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email belum benar."),
  password: z.string().min(1, "Password wajib diisi."),
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw new HttpError(401, "Email atau password salah.");
  }
  // Check the profile before handing out cookies.
  const user = await loadProfile(data.user.id, data.user.email ?? email);
  setSessionCookies(res, data.session);
  res.json({ user });
});

authRouter.post("/logout", async (req, res) => {
  const token = accessToken(req);
  if (token) await db.auth.admin.signOut(token).catch(() => undefined);
  clearSessionCookies(res);
  res.status(204).end();
});

authRouter.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password lama wajib diisi."),
    newPassword: z.string().min(8, "Password baru minimal 8 karakter.").max(72),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "Password baru harus berbeda.",
    path: ["newPassword"],
  });

authRouter.post("/password", loginLimiter, authenticate, async (req, res) => {
  const { currentPassword, newPassword } = parse(passwordSchema, req.body);
  const user = req.user!;
  const check = await authClient().auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (check.error) throw new HttpError(400, "Password lama salah.", { fields: { currentPassword: "Password lama salah." } });
  const { error } = await db.auth.admin.updateUserById(user.id, { password: newPassword });
  if (error) throw new HttpError(400, "Password baru tidak bisa dipakai. Coba yang lain.");
  res.status(204).end();
});
