/**
 * Server configuration, read once at startup. Fails fast with a clear message
 * when something required is missing, instead of failing on the first request.
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}${fallback ? ` (or ${fallback})` : ""}. See server/.env.example.`,
    );
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  isProduction: process.env.NODE_ENV === "production",
  supabaseUrl: required("SUPABASE_URL"),
  /** Secret key (sb_secret_…) or legacy service_role key — server only, never ship to a browser. */
  supabaseSecretKey: required("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
  /** Publishable key (sb_publishable_…) or legacy anon key — used only to sign users in. */
  supabasePublishableKey: required("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"),
  /**
   * Origins allowed to call mutating endpoints (CSRF guard). The dashboard
   * normally calls the API through the Next.js site (same origin), so this is
   * the site's public URL, e.g. https://www.your-domain.id.
   */
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:3001")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
