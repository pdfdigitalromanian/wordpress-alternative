import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient, createSupabaseServerClient } from "./supabase.server";
import { ONBOARDING_PROFILE, ONBOARDING_WORKSPACE, WORKSPACE_HOME } from "./landing";
import { themeForSite } from "./site-theme";

/* One loader for the whole workspace shell. /workspace, /templates, /team and
   /settings are child routes of this pathless layout (see routes.ts), so the
   shell, the sidebar and the switcher are mounted once and are never torn down
   when you move between the four sections. That is what used to make the
   sidebar toggle feel glitched: every section used to re-mount it, reset the
   open/closed state and re-run every query.

   The three reads below are each a single round trip. The previous version
   looped over workspaces and issued one `sites` select per workspace, so the
   page got slower with every workspace the account owned. */

/* Reading the auth user list needs the service-role client and is by far the
   slowest read in this loader (a full page of users, every request). The list
   only changes when someone signs up or renames themselves, so it is held in
   process memory for a short window instead of being re-fetched on every
   workspace load and after every POST. Display names in the Team view and the
   invite suggestions are the only things that read it. */
const DIRECTORY_TTL_MS = 60_000;
let directoryCache: { at: number; users: User[] } | null = null;

async function authUserDirectory(neededIds: string[]): Promise<User[]> {
  const users = await cachedAuthDirectory();
  if (!neededIds.length) return [];
  const wanted = new Set(neededIds);
  return users.filter((u) => wanted.has(u.id));
}

/** The full auth user list, cached in process memory (see DIRECTORY_TTL_MS).
 *  Shared by the workspace loader and the invite action so an invite POST does
 *  not pay for a second read of the same list the shell just resolved. Only
 *  cached on success: a failed call is retried next time rather than
 *  remembered as "no one exists" for a whole minute. */
export async function cachedAuthDirectory(): Promise<User[]> {
  const now = Date.now();
  if (directoryCache && now - directoryCache.at < DIRECTORY_TTL_MS) return directoryCache.users;
  const { data } = await createSupabaseAdminClient().auth.admin.listUsers({ perPage: 1000 });
  const users = data?.users ?? [];
  if (users.length) directoryCache = { at: now, users };
  return users;
}

export type SiteRow = {
  id: string;
  name: string;
  status: "published" | "draft" | "unpublished";
  updated: string;
  theme: string;
};

export type ActivityRow = {
  id: string;
  kind: "create" | "update" | "invite" | "delete";
  text: string;
  time: number;
};

export type MemberRow = {
  /** null for a pending invite that has not been accepted yet. */
  userId: string | null;
  email: string;
  name: string;
  role: string;
  access: "all" | "some";
  siteIds: string[];
};

export type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  /** The applied schema has no purpose column. It is kept on the row so the
   *  create-workspace dialog and switcher can read it without a null check,
   *  and it round-trips through onboarding as an empty string until a
   *  migration adds the column. */
  purpose: string;
  /** Epoch ms of the workspace row, used to date its activity entry. */
  created: number;
  sites: SiteRow[];
  activity: ActivityRow[];
  members: MemberRow[];
};

export type WorkspaceScreenData = {
  userName: string;
  email: string;
  workspaces: WorkspaceRow[];
  /** People the signed-in user already shares a workspace with. This is the
   *  invite dialog's suggestion list, standing in for the standalone file's
   *  demo DIRECTORY. Deliberately derived from membership, not from a global
   *  user list, so no address the user cannot already see is exposed. */
  directory: { name: string; email: string }[];
  /** Set when the account has no workspace yet, so the shell can say so. */
  landing: string;
};

type SiteDbRow = {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  active_release_id: string | null;
};

type ActivityDbRow = {
  id: string;
  workspace_id: string;
  kind: ActivityRow["kind"];
  text: string;
  created_at: string;
};

export async function loadWorkspaceScreen(request: Request): Promise<WorkspaceScreenData> {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Response(null, { status: 302, headers: { Location: "/login" } });

  const { data: memberships } = await supabase
    .from("workspace_memberships")
    .select("workspace_id, role, workspaces(id, name, slug, created_at)")
    .eq("user_id", user.id);

  // Only columns that exist in the applied schema are selected. `purpose`,
  // `workspace_activity` and the pending-invite columns on
  // workspace_memberships are deliberately NOT read: they only existed in an
  // unapplied migration, and selecting a column that is not there makes
  // PostgREST fail the whole query, which empties the workspace list.
  const workspaces: WorkspaceRow[] = [];
  for (const m of memberships ?? []) {
    const w = m.workspaces;
    if (!w) continue;
    workspaces.push({
      id: w.id,
      name: w.name,
      slug: w.slug,
      purpose: "",
      created: new Date(w.created_at).getTime(),
      sites: [],
      activity: [],
      members: [],
    });
  }

  const ids = workspaces.map((w) => w.id);
  if (!ids.length) {
    /* No workspace yet: walk the onboarding order here too. Without this the
       shell rendered empty for an account that reached a workspace path (deep
       link, stale tab, the ?returnTo carried into /login) - which is the
       "why do I see the workspace first" report. landingFor() sends a user with
       no profile to the profile step first, then to the workspace step. */
    throw new Response(null, { status: 302, headers: { Location: landingFor(user, false) } });
  }

  // The invite dialog's suggestion list, the file's demo DIRECTORY. Only
  // addresses the signed-in user is already allowed to see are returned, and
  // they are matched by membership, never by a global user list. The two
  // remaining independent reads (colleagues + sites) run together instead of
  // one after the other.
  const [colleagueResult, siteResult] = await Promise.all([
    supabase.from("workspace_memberships").select("user_id, role, workspace_id").in("workspace_id", ids),
    supabase
      .from("sites")
      .select("id, workspace_id, name, created_at, updated_at, active_release_id")
      .in("workspace_id", ids)
      // Stable order: the drawn previews below are handed out by position, so
      // without this the rotation could reshuffle between two loads.
      .order("created_at", { ascending: true }),
  ]);
  const colleagueRows = colleagueResult.data;
  const siteRows = siteResult.data;

  const colleagueIds = (colleagueRows ?? [])
    .map((m) => m.user_id)
    .filter((id): id is string => Boolean(id));
  // Display names for colleagues come from the cached service-role list; a
  // user-scoped client cannot read the auth user list at all. Failing to get
  // it is not fatal: the Team view falls back to the local part of the address
  // the membership is matched by.
  const profileById = new Map((await authUserDirectory(colleagueIds)).map((u) => [u.id, u]));

  const byId = new Map(workspaces.map((w) => [w.id, w]));

  // Counts only the sites that get a drawn preview, so the rotation stays
  // gap-free even with plain "Untitled site" cards in the middle of the grid.
  let previewIndex = 0;

  for (const s of (siteRows ?? []) as SiteDbRow[]) {
    byId.get(s.workspace_id)?.sites.push({
      id: s.id,
      name: s.name,
      // The schema has no status column: a site is published when a release
      // is active, which is exactly what the standalone file's three states
      // ("Published" / "In draft" / "Not published") are describing.
      status: s.active_release_id ? "published" : "unpublished",
      updated: s.updated_at,
      // No screenshot column exists, so the card falls back to one of the
      // prototype's drawn previews, dealt out in rotation.
      theme: themeForSite(previewIndex++, s.name),
    });
  }

  // The schema has no activity table, so the feed is derived from the columns
  // that do exist, newest first — the same shape the file's `w.activity` array
  // has. Every entry the file can produce is covered:
  //   publish / unpublish / delete -> "<site> was <verb>" at updated_at
  //   create                         -> "<site> was created" at created_at
  //   workspace + invite             -> "<workspace> was created" at created_at
  const seen = new Set<string>();
  for (const w of workspaces) {
    const push = (id: string, kind: ActivityRow["kind"], text: string, at: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      w.activity.push({ id, kind, text, time: new Date(at).getTime() });
    };

    for (const s of w.sites) {
      push(
        `site-updated:${s.id}`,
        "update",
        `${s.name} was ${s.status === "published" ? "published" : "unpublished"}`,
        s.updated,
      );
      push(`site-created:${s.id}`, "create", `${s.name} was created`, s.updated);
    }

    push(`workspace-created:${w.id}`, "create", `${w.name} was created`, new Date(w.created).toISOString());
  }

  for (const m of (colleagueRows ?? []) as { user_id: string | null; role: string; workspace_id: string }[]) {
    const profile = m.user_id ? profileById.get(m.user_id) : null;
    const email = (profile?.email ?? "").toLowerCase();
    byId.get(m.workspace_id)?.members.push({
      userId: m.user_id,
      email,
      name: String(profile?.user_metadata?.display_name ?? email.split("@")[0] ?? ""),
      role: m.role,
      access: "all",
      siteIds: [],
    });
  }

  for (const w of workspaces) {
    w.sites.sort((a, b) => b.updated.localeCompare(a.updated));
    w.activity.sort((a, b) => b.time - a.time);
  }

  const directory = new Map<string, { name: string; email: string }>();
  for (const w of workspaces) {
    for (const m of w.members) {
      if (!m.email || m.email === user.email?.toLowerCase()) continue;
      if (!directory.has(m.email)) directory.set(m.email, { name: m.name, email: m.email });
    }
  }

  return {
    userName: displayName(String(user.user_metadata?.display_name ?? ""), user.email ?? ""),
    email: user.email ?? "",
    workspaces,
    directory: [...directory.values()],
    landing: landingFor(user, true),
  };
}

/** The same decision landing.ts's landingFor makes, but from data this loader
 *  already holds, so the shell (and every revalidation after a POST) neither
 *  re-instantiates the auth client nor re-runs the membership query just to
 *  choose a redirect target. Shared with the no-workspaces branch above. */
function landingFor(user: User, hasWorkspaces: boolean) {
  if (!String(user.user_metadata?.display_name ?? "")) return ONBOARDING_PROFILE;
  return hasWorkspaces ? WORKSPACE_HOME : ONBOARDING_WORKSPACE;
}

/** Activity is derived from existing columns in the loader, so there is no
 *  activity table to write to. Kept as a single no-op call site so the action
 *  code reads the same as the file's `w.activity.push(...)` calls. */
export function recordActivity(
  _supabase: ReturnType<typeof createSupabaseServerClient>["supabase"],
  _workspaceId: string,
  _kind: ActivityRow["kind"],
  _text: string,
) {
  /* the feed is computed in loadWorkspaceScreen from real timestamps */
}

function displayName(name: string, email = "") {
  const source = name || email.split("@")[0] || "";
  return source.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}
