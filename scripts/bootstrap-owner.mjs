// Deliberate owner-bootstrap procedure (Part B §25 — never let the first
// arbitrary public signup become the workspace owner; there is no public
// sign-up route in apps/web at all). Creates exactly one auth user with a
// freshly generated password, using the server-only secret key, and
// writes the password to a local gitignored file instead of printing it
// to any log/chat — read it once, sign in, then change it.
//
// Usage: node --env-file=apps/web/.env.local scripts/bootstrap-owner.mjs <email>
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node --env-file=apps/web/.env.local scripts/bootstrap-owner.mjs <email>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY in env.");
  process.exit(1);
}

const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

const existing = await admin.auth.admin.listUsers();
if (existing.data.users.some((u) => u.email === email)) {
  console.error(`A user with email ${email} already exists — not creating a duplicate.`);
  process.exit(1);
}

const password = randomBytes(18).toString("base64url");
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });

if (created.error) {
  console.error("Failed to create user:", created.error.message);
  process.exit(1);
}

const outFile = new URL("../.owner-credentials.local", import.meta.url);
writeFileSync(outFile, `email=${email}\npassword=${password}\ncreated_at=${new Date().toISOString()}\n`, {
  mode: 0o600,
});

console.log(`User created: ${email}`);
console.log(`One-time password written to: ${outFile.pathname}`);
console.log("Read it, sign in at /login, then treat it as compromised (rotate it) once you're in.");
