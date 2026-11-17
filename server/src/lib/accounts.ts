import type { Request } from "express";
import { audit } from "./audit.js";
import { HttpError, notFound } from "./http.js";
import { db } from "./supabase.js";

export type Account = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "guru";
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

/** Profiles joined with their login email from Supabase Auth. */
export async function listAccounts(role?: "admin" | "guru"): Promise<Account[]> {
  let query = db.from("profiles").select("id, full_name, role, phone, is_active, created_at").order("full_name");
  if (role) query = query.eq("role", role);
  const { data: profiles, error } = await query;
  if (error) throw new Error(error.message);

  const authUsers = new Map<string, { email?: string; last_sign_in_at?: string }>();
  for (let page = 1; ; page++) {
    const { data, error: listError } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError) throw new Error(listError.message);
    for (const u of data.users) authUsers.set(u.id, u);
    if (data.users.length < 1000) break;
  }

  return (profiles ?? []).map((p) => ({
    id: p.id,
    email: authUsers.get(p.id)?.email ?? "",
    fullName: p.full_name,
    role: p.role,
    phone: p.phone,
    isActive: p.is_active,
    createdAt: p.created_at,
    lastSignInAt: authUsers.get(p.id)?.last_sign_in_at ?? null,
  }));
}

export async function createAccount(
  req: Request,
  input: { email: string; password: string; fullName: string; role: "admin" | "guru"; phone?: string | null },
) {
  const { data, error } = await db.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true, // admin-created accounts can sign in right away
  });
  if (error || !data.user) {
    const taken = error?.message.toLowerCase().includes("already");
    throw new HttpError(taken ? 409 : 400, taken ? "Email ini sudah dipakai akun lain." : "Akun tidak bisa dibuat. Periksa email dan password.");
  }
  const { error: profileError } = await db.from("profiles").insert({
    id: data.user.id,
    full_name: input.fullName,
    role: input.role,
    phone: input.phone || null,
  });
  if (profileError) {
    // Don't leave a half-created login behind.
    await db.auth.admin.deleteUser(data.user.id);
    throw new Error(profileError.message);
  }
  await audit(req, "create", "account", data.user.id, { email: input.email, role: input.role, fullName: input.fullName });
  return data.user.id;
}

async function activeAdminCount(excludeId: string) {
  const { count, error } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true)
    .neq("id", excludeId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function updateAccount(
  req: Request,
  id: string,
  input: { fullName?: string; role?: "admin" | "guru"; phone?: string | null; isActive?: boolean },
) {
  const { data: current, error } = await db.from("profiles").select("id, role, is_active").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!current) throw notFound("Akun tidak ditemukan.");

  const isSelf = req.user?.id === id;
  const losesAdmin =
    current.role === "admin" && ((input.role && input.role !== "admin") || input.isActive === false);
  if (isSelf && losesAdmin) throw new HttpError(400, "Kamu tidak bisa menonaktifkan atau menurunkan akunmu sendiri.");
  if (losesAdmin && (await activeAdminCount(id)) === 0) {
    throw new HttpError(400, "Harus ada minimal satu admin aktif.");
  }

  const update = {
    ...(input.fullName !== undefined ? { full_name: input.fullName } : {}),
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
  };
  const { error: updateError } = await db.from("profiles").update(update).eq("id", id);
  if (updateError) throw new Error(updateError.message);

  if (input.isActive !== undefined && input.isActive !== current.is_active) {
    // Also block/unblock the login itself, so existing sessions stop refreshing.
    await db.auth.admin.updateUserById(id, { ban_duration: input.isActive ? "none" : "876000h" });
  }
  await audit(req, "update", "account", id, input);
}

export async function setPassword(req: Request, id: string, password: string) {
  const { error } = await db.auth.admin.updateUserById(id, { password });
  if (error) throw new HttpError(400, "Password tidak bisa diganti. Coba password lain.");
  await audit(req, "reset_password", "account", id);
}

export async function deleteAccount(req: Request, id: string) {
  if (req.user?.id === id) throw new HttpError(400, "Kamu tidak bisa menghapus akunmu sendiri.");
  const { data: current } = await db.from("profiles").select("role, full_name").eq("id", id).maybeSingle();
  if (!current) throw notFound("Akun tidak ditemukan.");
  if (current.role === "admin" && (await activeAdminCount(id)) === 0) {
    throw new HttpError(400, "Harus ada minimal satu admin aktif.");
  }
  // Deleting the auth user cascades to the profile; students keep their record
  // with no teacher (teacher_id → null).
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  await audit(req, "delete", "account", id, { fullName: current.full_name, role: current.role });
}
