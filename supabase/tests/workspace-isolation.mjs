// Cross-workspace RLS isolation test, run against the linked hosted
// project (no local Docker Postgres available for `supabase test db`'s
// pgTAP shadow database — see docs/setup.md). Creates two throwaway
// users, exercises the RLS policies from
// supabase/migrations/20260920045632_initial_workspaces_sites.sql, then
// deletes everything it created.
//
// Run: node --env-file=apps/web/.env.local supabase/tests/workspace-isolation.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !anonKey || !secretKey) {
  console.error("Missing SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY in env.");
  process.exit(1);
}

const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

const suffix = Math.random().toString(36).slice(2, 10);
const userAEmail = `rls-test-a-${suffix}@example.invalid`;
const userBEmail = `rls-test-b-${suffix}@example.invalid`;
const password = `Rls-test-${suffix}!`;

let failures = 0;
function check(label, condition) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    failures += 1;
  }
}

function clientFor() {
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

let userA, userB, workspaceAId, siteAId;

try {
  const createdA = await admin.auth.admin.createUser({ email: userAEmail, password, email_confirm: true });
  const createdB = await admin.auth.admin.createUser({ email: userBEmail, password, email_confirm: true });
  if (createdA.error || createdB.error) {
    throw new Error(`user creation failed: ${createdA.error?.message ?? ""} ${createdB.error?.message ?? ""}`);
  }
  userA = createdA.data.user;
  userB = createdB.data.user;

  const clientA = clientFor();
  const signInA = await clientA.auth.signInWithPassword({ email: userAEmail, password });
  check("user A can sign in", !signInA.error);

  const clientB = clientFor();
  const signInB = await clientB.auth.signInWithPassword({ email: userBEmail, password });
  check("user B can sign in", !signInB.error);

  // User A creates a workspace. RLS insert policy requires created_by = auth.uid().
  const wsInsert = await clientA
    .from("workspaces")
    .insert({ name: `RLS test workspace ${suffix}`, slug: `rls-test-${suffix}`, created_by: userA.id })
    .select()
    .single();
  check("user A can create a workspace", !wsInsert.error && wsInsert.data);
  workspaceAId = wsInsert.data?.id;

  // The AFTER INSERT trigger should have made A the owner automatically.
  const ownerRow = await admin
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", workspaceAId)
    .eq("user_id", userA.id)
    .maybeSingle();
  check("owner membership row was auto-created by trigger", ownerRow.data?.role === "owner");

  // User A creates a site in their own workspace.
  const siteInsert = await clientA
    .from("sites")
    .insert({ workspace_id: workspaceAId, name: "Test Site", slug: "test-site" })
    .select()
    .single();
  check("user A can create a site in their own workspace", !siteInsert.error && siteInsert.data);
  siteAId = siteInsert.data?.id;

  // User B must not see user A's workspace at all.
  const bReadsWorkspace = await clientB.from("workspaces").select("id").eq("id", workspaceAId);
  check("user B's select of A's workspace returns zero rows", (bReadsWorkspace.data?.length ?? -1) === 0);

  // User B must not see user A's site.
  const bReadsSite = await clientB.from("sites").select("id").eq("id", siteAId);
  check("user B's select of A's site returns zero rows", (bReadsSite.data?.length ?? -1) === 0);

  // User B must not be able to insert a site into A's workspace by guessing its ID.
  const bInsertSite = await clientB
    .from("sites")
    .insert({ workspace_id: workspaceAId, name: "Hijack attempt", slug: "hijack" })
    .select();
  check("user B cannot insert a site into A's workspace", !!bInsertSite.error && (bInsertSite.data?.length ?? 0) === 0);

  // User B must not be able to add themselves as a member of A's workspace.
  const bInsertMembership = await clientB
    .from("workspace_memberships")
    .insert({ workspace_id: workspaceAId, user_id: userB.id, role: "owner" })
    .select();
  check(
    "user B cannot insert themselves into A's workspace_memberships",
    !!bInsertMembership.error && (bInsertMembership.data?.length ?? 0) === 0
  );

  // User B must not be able to update A's site.
  const bUpdateSite = await clientB.from("sites").update({ name: "Renamed by B" }).eq("id", siteAId).select();
  check("user B cannot update A's site", (bUpdateSite.data?.length ?? 0) === 0);
} finally {
  // Cleanup: cascade delete removes memberships/sites/domains for the test workspace.
  if (workspaceAId) {
    await admin.from("workspaces").delete().eq("id", workspaceAId);
  }
  if (userA) await admin.auth.admin.deleteUser(userA.id);
  if (userB) await admin.auth.admin.deleteUser(userB.id);
}

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
