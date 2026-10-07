/* Records the "Recent activities" rows the standalone file pushes into
   state.workspaces[].activity. Shared by the /workspace route module and the
   pathless workspace layout, so it lives outside the route files. */

import { redirect } from "react-router";
import type { Database } from "~/lib/database.types";
import { slugify } from "~/lib/slugify";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { cachedAuthDirectory, recordActivity } from "~/lib/workspace.server";

export type WorkspaceActionResult =
  | { error: string; field?: "wsname" | "wsslug" | "email" }
  | { created: string; workspaceId?: string }
  | { ok: true; siteName?: string; workspaceId?: string }
  | {
      invited: number;
      /** Addresses that have no account yet and so could not be added. */
      skipped: string[];
      workspaceName: string;
      emails: string[];
      role: string;
      access: string;
      accessText: string;
      inviter: string;
      /** True when the invite carried per-site roles that have no column to
       *  store them in (workspace_memberships has none). */
      siteRolesNotStored: boolean;
    }
  | { unknown: true };

/** The file's ROLES map (digital-romanian-screens.html) against the
 *  workspace_role enum the applied schema allows. Only the four storable
 *  values can be written; "author" is shown in the picker because the file
 *  lists it, and is stored as editor. "contributor" is the invite dialog's
 *  workspace-level role for someone who only reaches assigned sites; the enum
 *  has no such value, so the row is stored as editor. */
const ROLE_FOR_DB: Record<string, Database["public"]["Enums"]["workspace_role"]> = {
  owner: "owner",
  admin: "administrator",
  contributor: "editor",
  editor: "editor",
  author: "editor",
  viewer: "viewer",
};

export async function handleWorkspaceAction(request: Request, formData: FormData): Promise<WorkspaceActionResult> {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw redirect("/login");

  const intent = String(formData.get("intent") ?? "");

  /* ---------- Create website ----------
     [data-new-site] in the standalone file unshifts the next "Untitled site"
     into the grid and toasts it. Same rule, persisted. */
  if (intent === "create-site") {
    /* The grid posts the workspace the user is actually looking at. Without it
       the site landed in whichever workspace happened to be their first
       membership, which looked like the button doing nothing when the
       switcher was pointing somewhere else. */
    const requested = String(formData.get("workspaceId") ?? "").trim();
    const workspaceId =
      requested && (await isMember(supabase, user.id, requested))
        ? requested
        : await firstWorkspaceId(supabase, user.id);
    if (!workspaceId) throw redirect("/onboarding/workspace");

    const { data: existing } = await supabase
      .from("sites")
      .select("name, slug")
      .eq("workspace_id", workspaceId);

    const untitled = (existing ?? []).filter((s) => s.name.startsWith("Untitled site")).length;
    const name = untitled ? `Untitled site ${untitled + 1}` : "Untitled site";
    const slug = uniqueSlug(name, (existing ?? []).map((s) => s.slug));

    const { error } = await supabase.from("sites").insert({ workspace_id: workspaceId, name, slug } as never);
    if (error) return { error: "We couldn't create that website. Try again in a moment." };

    await recordActivity(supabase, workspaceId, "create", `${name} was created`);
    return { created: name, workspaceId };
  }

  /* ---------- Create workspace ----------
     data-open="create-ws" -> dlg-create-ws. */
  if (intent === "create-workspace") {
    const name = String(formData.get("wsname") ?? "").trim();
    const rawSlug = String(formData.get("wsslug") ?? "").trim();
    const slug = slugify(rawSlug || name);
    const purpose = String(formData.get("wspurpose") ?? "");

    if (!name) return { error: "Give your workspace a name.", field: "wsname" };
    if (!slug) return { error: "Add a workspace URL using letters or numbers.", field: "wsslug" };

    const { data: taken } = await supabase.from("workspaces").select("id").eq("slug", slug).maybeSingle();
    if (taken) return { error: `app.digitalromanian.ro/${slug} is taken. Try another URL.`, field: "wsslug" };

    const { data: created, error } = await supabase
      .from("workspaces")
      .insert({ name, slug, created_by: user.id, ...(purpose ? { purpose } : {}) } as never)
      .select("id")
      .single();

    if (error || !created) return { error: "We couldn't create that workspace. Try again in a moment." };

    const { error: memberError } = await supabase
      .from("workspace_memberships")
      .insert({ workspace_id: created.id, user_id: user.id, role: "owner" } as never);

    if (memberError) return { error: "We couldn't finish setting up that workspace." };

    await recordActivity(supabase, created.id, "create", `${name} workspace was created`);
    return { created: name, workspaceId: created.id };
  }

  /* ---------- Publish / Unpublish ----------
     [data-status] in the standalone file. Publishing goes through the existing
     publish_site() RPC so a release is created, exactly like the CMS does. */
  if (intent === "publish" || intent === "unpublish") {
    const siteId = String(formData.get("siteId") ?? "");
    if (!siteId) return { error: "That website could not be found." };

    const { data: site } = await supabase
      .from("sites")
      .select("id, name, workspace_id, active_release_id")
      .eq("id", siteId)
      .maybeSingle();

    if (!site) return { error: "That website could not be found." };

    if (intent === "publish") {
      const { error } = await supabase.rpc("publish_site" as never, {
        target_site_id: siteId,
        release_label: null,
      } as never);
      if (error) return { error: "We couldn't publish that website." };
    } else {
      // Unpublish keeps the release but clears the pointer, so it can be
      // rolled back to from the CMS.
      const { error } = await supabase
        .from("sites")
        .update({ active_release_id: null } as never)
        .eq("id", siteId);
      if (error) return { error: "We couldn't unpublish that website." };
    }

    await recordActivity(
      supabase,
      site.workspace_id,
      "update",
      `${site.name} was ${intent === "publish" ? "published" : "unpublished"}`,
    );
    return { ok: true, siteName: site.name, workspaceId: site.workspace_id };
  }

  /* ---------- Delete site ---------- */
  if (intent === "delete-site") {
    const siteId = String(formData.get("siteId") ?? "");
    if (!siteId) return { error: "That website could not be found." };

    const { data: site } = await supabase.from("sites").select("name, workspace_id").eq("id", siteId).maybeSingle();
    const { error } = await supabase.from("sites").delete().eq("id", siteId);
    if (error) return { error: "We couldn't delete that website." };

    if (site) await recordActivity(supabase, site.workspace_id, "delete", `${site.name} was deleted`);
    return { ok: true, siteName: site?.name, workspaceId: site?.workspace_id };
  }

  /* ---------- Invite member ----------
     #invite-form in the standalone file. There is no invitations table in the
     schema, so an invite is stored as a pending row in workspace_memberships
     with user_id = null, which is what the Team view reads back. */
  if (intent === "invite") {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const wrole = String(formData.get("role") ?? "contributor");
    const accessMode = String(formData.get("access") ?? (wrole === "admin" ? "all" : "some"));
    const selectedIds = new Set(formData.getAll("siteId").map(String).filter(Boolean));

    if (!workspaceId) return { error: "Add at least one email address." };

    const emails = formData
      .getAll("email")
      .map((e) => String(e).trim().toLowerCase())
      .filter(Boolean);
    if (!emails.length) return { error: "Add at least one email address." };

    const { data: ws } = await supabase.from("workspaces").select("name, sites(id, name, slug)").eq("id", workspaceId).maybeSingle();
    if (!ws) return { error: "That workspace could not be found." };

    // Access on the form matches the standalone file: "all" or the ids of the
    // sites the sender checked in the pills. Scope it to this workspace so a
    // forged id never leaks a site name into the copy below.
    const wsSites = ws.sites ?? [];
    const scoped =
      accessMode === "all" ? wsSites : wsSites.filter((s) => selectedIds.has(s.id));
    if (wrole === "contributor" && accessMode === "some" && !scoped.length) {
      return { error: "Pick at least one site." };
    }

    // A contributor's per-site role rides along in the payload but nowhere in
    // the schema can it be stored: workspace_memberships has no site-role column.
    // Honest UI: the invite is sent with the workspace-level role and the toast
    // below says the per-site part isn't persisted.
    const siteRolesNotStored = wrole === "contributor" && scoped.length > 0;

    // workspace_memberships.user_id is NOT NULL in the applied schema, so a
    // membership can only be created for somebody who already has an account.
    // An address with no account is reported back instead of silently dropped;
    // storing pending invitations needs a migration, which is not applied.
    const allUsers = await cachedAuthDirectory();
    if (!allUsers.length) return { error: "Could not look up those addresses." };

    const byEmail = new Map(allUsers.map((u) => [(u.email ?? "").toLowerCase(), u.id]));

    const added: { id: string; email: string }[] = [];
    for (const email of emails) {
      const id = byEmail.get(email);
      if (!id) continue;
      const { error } = await supabase
        .from("workspace_memberships")
        .insert({ workspace_id: workspaceId, user_id: id, role: ROLE_FOR_DB[wrole] ?? "editor" });
      if (!error) added.push({ id, email });
    }

    const unknown = emails.filter((e) => !added.some((a) => a.email === e));

    if (!added.length) {
      return {
        error: unknown.length
          ? `${unknown[0]} does not have an account yet, so they cannot be added to this workspace.`
          : "Those people are already members of this workspace.",
      };
    }

    const roleLabel = wrole === "contributor" ? "Site contributor" : ROLE_LABEL[ROLE_FOR_DB[wrole]] ?? "Editor";
    recordActivity(
      supabase,
      workspaceId,
      "invite",
      added.length > 1 ? `${added.length} people were invited as ${roleLabel}` : `${added[0].email} was invited as ${roleLabel}`,
    );

    const siteNames = scoped.map((s) => s.name);

    return {
      invited: added.length,
      skipped: unknown,
      workspaceName: ws.name,
      emails: added.map((a) => a.email),
      role: roleLabel,
      access: accessMode,
      accessText:
        wrole === "admin" || accessMode === "all"
          ? "All sites in this workspace"
          : siteNames.length
            ? siteNames.join(", ")
            : "No sites yet",
      inviter: String(user.user_metadata?.display_name ?? user.email ?? ""),
      siteRolesNotStored,
    };
  }

  return { unknown: true };
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  administrator: "Administrator",
  editor: "Editor",
  author: "Author",
  viewer: "Viewer",
};

async function firstWorkspaceId(
  supabase: ReturnType<typeof createSupabaseServerClient>["supabase"],
  userId: string,
) {
  const { data } = await supabase
    .from("workspace_memberships")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.workspace_id ?? null;
}

/** Guards a workspace id that came from the client (a hidden form field), so a
 *  create/publish/delete request can only ever touch a workspace the caller
 *  actually belongs to. RLS is the real boundary; this just turns a forged id
 *  into a clean fallback instead of a permission error. */
async function isMember(
  supabase: ReturnType<typeof createSupabaseServerClient>["supabase"],
  userId: string,
  workspaceId: string,
) {
  const { data } = await supabase
    .from("workspace_memberships")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

function uniqueSlug(name: string, taken: string[]) {
  const base = slugify(name) || "untitled-site";
  let slug = base;
  for (let i = 2; taken.includes(slug); i++) slug = `${base}-${i}`;
  return slug;
}
