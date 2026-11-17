/**
 * Creates the first admin account (run once after applying the migration):
 *
 *   npm run create-admin -- admin@email.com "Password-Rahasia" "Nama Admin"
 *
 * After that, the admin adds teachers and other admins from the dashboard.
 */
import { createClient } from "@supabase/supabase-js";

const [email, password, fullName = "Admin"] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> <password> ["Full Name"]');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in server/.env first.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (error || !data.user) {
  console.error("Could not create the login:", error?.message);
  process.exit(1);
}
const { error: profileError } = await db
  .from("profiles")
  .insert({ id: data.user.id, full_name: fullName, role: "admin" });
if (profileError) {
  await db.auth.admin.deleteUser(data.user.id);
  console.error("Could not create the profile (did you run the SQL migration?):", profileError.message);
  process.exit(1);
}
console.log(`Admin created: ${email}. Sign in at /login on the dashboard (http://localhost:3001/login).`);
