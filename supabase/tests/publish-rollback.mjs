// Verifies publish_site()/rollback_site() against the hosted project:
// atomicity, permission checks, and that a draft edit never touches an
// already-published release. Creates its own workspace/site/pages/users,
// deletes everything afterward.
//
// Run: node --env-file=apps/web/.env.local supabase/tests/publish-rollback.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = Math.random().toString(36).slice(2, 10);

let failures = 0;
function check(label, condition) {
  if (condition) console.log(`PASS: ${label}`);
  else {
    console.error(`FAIL: ${label}`);
    failures += 1;
  }
}

const ownerEmail = `pub-test-owner-${suffix}@example.invalid`;
const viewerEmail = `pub-test-viewer-${suffix}@example.invalid`;
const outsiderEmail = `pub-test-outsider-${suffix}@example.invalid`;
const password = `Pub-test-${suffix}!`;

let owner, viewer, outsider, workspaceId, siteId, pageId;

try {
  const [createdOwner, createdViewer, createdOutsider] = await Promise.all([
    admin.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true }),
    admin.auth.admin.createUser({ email: viewerEmail, password, email_confirm: true }),
    admin.auth.admin.createUser({ email: outsiderEmail, password, email_confirm: true }),
  ]);
  owner = createdOwner.data.user;
  viewer = createdViewer.data.user;
  outsider = createdOutsider.data.user;

  const ownerClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await ownerClient.auth.signInWithPassword({ email: ownerEmail, password });

  const ws = await ownerClient
    .from("workspaces")
    .insert({ name: `Pub test ${suffix}`, slug: `pub-test-${suffix}`, created_by: owner.id })
    .select()
    .single();
  workspaceId = ws.data?.id;
  check("owner creates workspace", !ws.error && workspaceId);

  const site = await ownerClient
    .from("sites")
    .insert({ workspace_id: workspaceId, name: "Pub Test Site", slug: "pub-test-site" })
    .select()
    .single();
  siteId = site.data?.id;
  check("owner creates site", !site.error && siteId);

  // Add viewer as a workspace viewer (read-only).
  const membership = await admin
    .from("workspace_memberships")
    .insert({ workspace_id: workspaceId, user_id: viewer.id, role: "viewer" })
    .select();
  check("admin adds viewer membership", !membership.error);

  const page = await ownerClient
    .from("pages")
    .insert({
      site_id: siteId,
      slug: "",
      title: "Home v1",
      draft_document: { content: [], root: { props: { title: "Home v1" } } },
      created_by: owner.id,
    })
    .select()
    .single();
  pageId = page.data?.id;
  check("owner creates a draft page", !page.error && pageId);

  const viewerClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await viewerClient.auth.signInWithPassword({ email: viewerEmail, password });

  const viewerEditAttempt = await viewerClient
    .from("pages")
    .update({ title: "Hacked by viewer" })
    .eq("id", pageId)
    .select();
  check(
    "viewer cannot edit a draft page",
    (viewerEditAttempt.data?.length ?? 0) === 0,
  );

  const outsiderClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await outsiderClient.auth.signInWithPassword({ email: outsiderEmail, password });

  const outsiderPublish = await outsiderClient.rpc("publish_site", { target_site_id: siteId });
  check("outsider cannot call publish_site", !!outsiderPublish.error);

  const viewerPublish = await viewerClient.rpc("publish_site", { target_site_id: siteId });
  check("viewer (read-only role) cannot call publish_site", !!viewerPublish.error);

  const publish1 = await ownerClient.rpc("publish_site", { target_site_id: siteId, release_label: "v1" });
  check("owner can publish", !publish1.error && publish1.data?.id);
  const release1Id = publish1.data?.id;

  const siteAfterPublish1 = await admin.from("sites").select("active_release_id").eq("id", siteId).single();
  check("active_release_id points at release 1 after first publish", siteAfterPublish1.data?.active_release_id === release1Id);

  const releasePages1 = await admin.from("release_pages").select("title, slug").eq("release_id", release1Id);
  check(
    "release 1 snapshot has the page as it was at publish time",
    releasePages1.data?.length === 1 && releasePages1.data[0].title === "Home v1",
  );

  // Edit the draft AFTER publishing — release 1 must stay frozen.
  const draftEdit = await ownerClient.from("pages").update({ title: "Home v2 (draft)" }).eq("id", pageId).select();
  check("owner edits draft after publish", !draftEdit.error);

  const release1AfterDraftEdit = await admin.from("release_pages").select("title").eq("release_id", release1Id).single();
  check(
    "release 1's snapshot is untouched by the later draft edit",
    release1AfterDraftEdit.data?.title === "Home v1",
  );

  const siteStillOnRelease1 = await admin.from("sites").select("active_release_id").eq("id", siteId).single();
  check(
    "editing the draft did not change the live release",
    siteStillOnRelease1.data?.active_release_id === release1Id,
  );

  const publish2 = await ownerClient.rpc("publish_site", { target_site_id: siteId, release_label: "v2" });
  check("owner publishes release 2", !publish2.error && publish2.data?.id);
  const release2Id = publish2.data?.id;

  const siteAfterPublish2 = await admin.from("sites").select("active_release_id").eq("id", siteId).single();
  check("active_release_id advances to release 2", siteAfterPublish2.data?.active_release_id === release2Id);

  const rollback = await ownerClient.rpc("rollback_site", { target_site_id: siteId, target_release_id: release1Id });
  check("owner rolls back to release 1", !rollback.error);

  const siteAfterRollback = await admin.from("sites").select("active_release_id").eq("id", siteId).single();
  check("active_release_id is back to release 1 after rollback", siteAfterRollback.data?.active_release_id === release1Id);

  // A release from a foreign site must be rejected.
  const otherSite = await ownerClient
    .from("sites")
    .insert({ workspace_id: workspaceId, name: "Other Site", slug: "other-site" })
    .select()
    .single();
  const crossSiteRollback = await ownerClient.rpc("rollback_site", {
    target_site_id: otherSite.data.id,
    target_release_id: release1Id,
  });
  check("cannot roll back a site to another site's release", !!crossSiteRollback.error);
} finally {
  if (workspaceId) await admin.from("workspaces").delete().eq("id", workspaceId);
  if (owner) await admin.auth.admin.deleteUser(owner.id);
  if (viewer) await admin.auth.admin.deleteUser(viewer.id);
  if (outsider) await admin.auth.admin.deleteUser(outsider.id);
}

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
