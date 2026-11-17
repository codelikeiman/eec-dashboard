import type { CookieOptions, NextFunction, Request, Response } from "express";
import type { Session } from "@supabase/supabase-js";
import { env } from "../env.js";
import { HttpError } from "../lib/http.js";
import { authClient, db } from "../lib/supabase.js";

export type Role = "admin" | "guru";
export type AuthUser = { id: string; email: string; fullName: string; role: Role };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const ACCESS_COOKIE = "eec_at";
const REFRESH_COOKIE = "eec_rt";

const baseCookie: CookieOptions = {
  httpOnly: true, // JavaScript can never read the tokens
  secure: env.isProduction,
  sameSite: "lax",
  path: "/",
};

export function setSessionCookies(res: Response, session: Session) {
  res.cookie(ACCESS_COOKIE, session.access_token, {
    ...baseCookie,
    maxAge: (session.expires_in ?? 3600) * 1000,
  });
  res.cookie(REFRESH_COOKIE, session.refresh_token, {
    ...baseCookie,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, baseCookie);
  res.clearCookie(REFRESH_COOKIE, baseCookie);
}

export function accessToken(req: Request): string | undefined {
  return req.cookies?.[ACCESS_COOKIE];
}

export async function loadProfile(userId: string, email: string): Promise<AuthUser> {
  const { data: profile, error } = await db
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // An auth account without a profile (e.g. someone signed up with the public
  // key) gets no access at all.
  if (!profile) throw new HttpError(403, "Akun ini belum terdaftar di dashboard.");
  if (!profile.is_active) throw new HttpError(403, "Akun ini dinonaktifkan. Hubungi admin.");
  return { id: profile.id, email, fullName: profile.full_name, role: profile.role };
}

/**
 * Verifies the session cookie with Supabase Auth. If the access token has
 * expired, silently refreshes it with the refresh token.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[ACCESS_COOKIE];
  const refresh = req.cookies?.[REFRESH_COOKIE];

  let user: { id: string; email?: string } | null = null;
  if (token) {
    const { data } = await db.auth.getUser(token);
    user = data.user;
  }
  if (!user && refresh) {
    const { data } = await authClient().auth.refreshSession({ refresh_token: refresh });
    if (data.session && data.user) {
      setSessionCookies(res, data.session);
      user = data.user;
    }
  }
  if (!user) {
    clearSessionCookies(res);
    throw new HttpError(401, "Sesi berakhir. Silakan masuk lagi.");
  }

  req.user = await loadProfile(user.id, user.email ?? "");
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new HttpError(403, "Kamu tidak punya akses ke fitur ini.");
    }
    next();
  };
}

/**
 * CSRF guard for cookie auth: state-changing requests must come from one of
 * our own origins. (Cookies are also SameSite=Lax.)
 */
export function checkOrigin(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin && !env.allowedOrigins.includes(origin)) {
    throw new HttpError(403, "Permintaan ditolak (origin tidak dikenal).");
  }
  next();
}
