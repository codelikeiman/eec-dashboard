import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env.js";

const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/**
 * Admin client (secret key). Bypasses Row Level Security — every query made
 * with it must already be authorised by our own middleware.
 */
export const db: SupabaseClient = createClient(env.supabaseUrl, env.supabaseSecretKey, options);

/**
 * A fresh, stateless client for signing a user in / refreshing a session.
 * Never shared between requests, so sessions can't leak across users.
 */
export function authClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, options);
}

/**
 * Supabase returns at most 1000 rows per request. Pages through a query until
 * everything is loaded (fine for a course with a few hundred students).
 */
export async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    // Supabase types a to-one join as an array; at runtime it's an object.
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
