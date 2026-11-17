import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { errorHandler, HttpError } from "./lib/http.js";
import { authenticate, checkOrigin, requireRole } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { classesRouter } from "./routes/classes.js";
import { paymentsRouter } from "./routes/payments.js";
import { reportsRouter } from "./routes/reports.js";
import { studentsRouter } from "./routes/students.js";
import { teachersRouter } from "./routes/teachers.js";
import { usersRouter } from "./routes/users.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Behind Next.js rewrites / a hosting proxy: trust the first hop for IPs
  // (rate limiting) and the https flag.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());
  app.use(checkOrigin);
  // Responses contain personal and financial data: never cache them.
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);

  // Everything below needs a signed-in user.
  app.use("/api", authenticate);

  // Admins and teachers (the router narrows teachers to their own students).
  app.use("/api/students", studentsRouter);

  // Admin only.
  const admin = requireRole("admin");
  app.use("/api/classes", admin, classesRouter);
  app.use("/api/teachers", admin, teachersRouter);
  app.use("/api/users", admin, usersRouter);
  app.use("/api/payments", admin, paymentsRouter);
  app.use("/api/reports", admin, reportsRouter);

  app.use("/api", () => {
    throw new HttpError(404, "Endpoint tidak ditemukan.");
  });
  app.use(errorHandler);
  return app;
}
