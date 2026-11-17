import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";

/** An error with an HTTP status and a message that is safe to show users. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const notFound = (message = "Data tidak ditemukan.") => new HttpError(404, message);

/** Parses and validates input with Zod; throws a 400 with field errors. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    throw badRequest("Data yang dikirim belum valid.", { fields });
  }
  return result.data as NonNullable<T>;
}

/** Throws when Supabase returned an error; maps common Postgres codes. */
export function check<T>(result: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  if (result.error) {
    const { code, message } = result.error;
    if (code === "23505") throw new HttpError(409, "Data dengan nama itu sudah ada.");
    if (code === "23503") throw new HttpError(409, "Data ini masih dipakai di tempat lain.");
    if (code === "23514" || code === "22P02") throw badRequest("Data yang dikirim belum valid.");
    throw new Error(message);
  }
  return result.data as NonNullable<T>;
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, details: error.details });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: "Data yang dikirim belum valid." });
    return;
  }
  // Malformed JSON bodies from express.json()
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "Format JSON tidak valid." });
    return;
  }
  console.error("[api] unexpected error:", error);
  res.status(500).json({ error: "Terjadi kesalahan di server. Coba lagi sebentar." });
}
