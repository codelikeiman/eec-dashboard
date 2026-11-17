import type { Request } from "express";
import { db } from "./supabase.js";

/**
 * Writes an entry to the activity log. Never blocks or fails the request —
 * a logging hiccup must not stop someone from recording a payment.
 */
export async function audit(
  req: Request,
  action: string,
  entity: string,
  entityId: string | string[] | null,
  details: Record<string, unknown> = {},
) {
  const { error } = await db.from("audit_log").insert({
    actor_id: req.user?.id ?? null,
    action,
    entity,
    entity_id: Array.isArray(entityId) ? entityId.join(",") : entityId,
    details,
  });
  if (error) console.warn("[audit] failed to write log:", error.message);
}
