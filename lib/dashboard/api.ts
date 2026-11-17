/**
 * Tiny client for the Express API (reached same-origin via the /api rewrite).
 * Session cookies are httpOnly, so the browser sends them automatically and
 * no token ever touches JavaScript.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
    signal: options.signal,
  });

  if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/")) {
    // Session expired: back to the login page, then return here.
    const next = encodeURIComponent(window.location.pathname);
    // A full reload is intended here: it drops all client state of the expired session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${next}`);
    throw new ApiError(401, "Sesi berakhir. Silakan masuk lagi.");
  }
  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error ?? "Terjadi kesalahan. Coba lagi.",
      data.details?.fields ?? {},
      data.details,
    );
  }
  return data as T;
}
