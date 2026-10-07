import { useMemo, useState } from "react";
import { useSubmit } from "react-router";
import { Pmark } from "~/components/workspace-sidebar";
import { useWorkspaceChrome } from "~/components/workspace-shell";
import { ROLE_TINT, RolePill, siteAccessText, tint } from "~/lib/workspace-views";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/team";

/* renderTeam(), from digital-romanian-screen.html lines 2192-2244, with its
   demo members replaced by the workspace's real membership rows.

   The prototype's rows come from `w.members`, which the workspace layout's
   loadWorkspaceScreen already builds for the sidebar. This route reads that
   list from the layout's data (via the chrome context) rather than querying
   workspace_memberships a second time - clicking Team is then just a re-render
   of already-loaded rows, not another round of database calls.

   The layout only re-runs its loader after a POST, so a role change or a
   removal refreshes the very list the sidebar renders.

   That list is `workspace_memberships` with resolved names, and the applied
   schema has no invitations table (and user_id is NOT NULL), so every row here
   is an accepted member and every one is Active. The pending branch is kept in
   the row type so the Status column reads "Invited" the moment an invitations
   table exists.

   The row actions the prototype offers - change role, remove member - are
   supported by the columns that exist, so they POST for real; they are hidden
   for anyone who is not an owner or administrator, and the action re-checks
   that role server-side because a hidden control is not an authorization
   boundary. Invite-related actions are omitted rather than shown dead. */

const icon = (id: string, w = 16, h = w, vb = `0 0 ${w} ${h}`) => (
  <svg width={w} height={h} viewBox={vb} fill="none" aria-hidden="true">
    <use href={`#${id}`} />
  </svg>
);

const svg = (path: React.ReactNode) => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    {path}
  </svg>
);

export type TeamMember = {
  userId: string | null;
  email: string;
  name: string;
  role: string;
  /** null for a pending invite; "all" today (no per-site column exists). */
  access: "all" | "some";
  siteIds: string[];
  pending: boolean;
  you: boolean;
};

const FILTERS = [
  { key: "all", label: "Total members" },
  { key: "owner", label: "Owner" },
  { key: "admin", label: "Admins" },
  { key: "contributor", label: "Contributors" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"] | "administrator" | "editor";

/** The prototype's filter keys are owner/admin/contributor; the database enum
 *  spells two of them differently. Map the enum onto the display filter so the
 *  counts a user sees add up to the rows they can see. */
function filterKeyForRole(role: string): FilterKey {
  if (role === "owner") return "owner";
  if (role === "admin" || role === "administrator") return "admin";
  return "contributor";
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const targetUserId = String(formData.get("userId") ?? "");
  const targetRole = String(formData.get("role") ?? "");

  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const workspaceId = String(formData.get("workspaceId") ?? "");

  /* Only an owner or administrator may change the team. Checked here as well as
     by RLS so the UI can hide the controls, and because a hidden control is not
     an authorization boundary. */
  const { data: mine } = await supabase
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  const mineRole = mine?.role ?? "";
  if (mineRole !== "owner" && mineRole !== "administrator") {
    return { error: "You don't have permission to change the team." };
  }

  if (intent === "remove-member") {
    /* The last owner must not be able to remove themselves and leave the
       workspace with nobody who can administer it. */
    if (targetUserId === user.id) {
      const { data: owners } = await supabase
        .from("workspace_memberships")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("role", "owner");
      if ((owners ?? []).length <= 1) {
        return { error: "A workspace needs at least one owner." };
      }
    }
    const { error } = await supabase
      .from("workspace_memberships")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", targetUserId);
    if (error) return { error: "We couldn't remove that person. Try again in a moment." };
    return { removed: true };
  }

  if (intent === "set-role") {
    if (targetUserId === user.id) return { error: "You can't change your own role." };
    /* role is cast through a fixed list so a tampered form field cannot write an
       arbitrary string into a typed enum column. */
    const allowed = ["administrator", "editor", "viewer"] as const;
    if (!allowed.includes(targetRole as (typeof allowed)[number])) {
      return { error: "That role doesn't exist." };
    }
    const { error } = await supabase
      .from("workspace_memberships")
      .update({ role: targetRole } as never)
      .eq("workspace_id", workspaceId)
      .eq("user_id", targetUserId);
    if (error) return { error: "We couldn't change that role. Try again in a moment." };
    return { saved: true };
  }

  return { error: "Unknown action." };
}

export default function WorkspaceTeam() {
  const chrome = useWorkspaceChrome();
  const { data: screen, currentId, openInvite } = chrome;
  const workspace = screen.workspaces.find((w) => w.id === currentId) ?? screen.workspaces[0] ?? null;
  const submit = useSubmit();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [pending, setPending] = useState<TeamMember | null>(null);

  const members: TeamMember[] = (workspace?.members ?? []).map((m) => ({
    userId: m.userId,
    email: m.email,
    name: m.name,
    role: m.role,
    access: m.access,
    siteIds: workspace?.sites.filter((s) => m.siteIds.includes(s.id)).map((s) => s.name) ?? [],
    pending: false,
    you: m.email === screen.email.toLowerCase(),
  }));

  const youRole = workspace?.members.find((m) => m.email === screen.email.toLowerCase())?.role ?? "viewer";
  const workspaceId = workspace?.id ?? "";

  const canManage = youRole === "owner" || youRole === "administrator";

  const count = (role: FilterKey) =>
    members.filter((m) => (role === "all" ? true : filterKeyForRole(m.role) === role)).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        (filter === "all" || filterKeyForRole(m.role) === filter) &&
        (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)),
    );
  }, [members, filter, query]);

  return (
    <>
      <div className="wsd-head">
        <div>
          <p className="eyebrow">Team</p>
          <h1 tabIndex={-1}>Workspace members</h1>
          <p>Manage who can access and work on your sites in this workspace.</p>
        </div>
        <div className="wsd-tools">
          <div className="search-box">
            {icon("i-search")}
            <label className="sr-only" htmlFor="team-search">
              Search members
            </label>
            <input
              id="team-search"
              type="search"
              placeholder="Search members"
              value={query}
              autoComplete="off"
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </div>
          <button type="button" className="btn-dark" onClick={openInvite}>
            {icon("i-plus", 18)}
            <span>
              Invite <span className="long">member</span>
            </span>
          </button>
        </div>
      </div>

      <div className="stats c4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="stat"
            aria-pressed={filter === f.key}
            onClick={() => setFilter((current) => (current === f.key ? "all" : f.key))}
          >
            <span
              className="ic tint"
              style={
                {
                  "--tc": f.key === "owner" ? ROLE_TINT.owner : f.key === "admin" ? ROLE_TINT.admin : f.key === "contributor" ? ROLE_TINT.contributor : "#f5f4ef",
                } as React.CSSProperties
              }
            >
              {f.key === "all" ? (
                icon("i-team", 16)
              ) : f.key === "owner" ? (
                svg(<path d="M2.5 5l2.8 2.3L8 3.5l2.7 3.8L13.5 5l-1.2 7H3.7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />)
              ) : f.key === "admin" ? (
                svg(<path d="M8 2l5 2v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />)
              ) : (
                icon("i-pencil", 14)
              )}
            </span>
            <span className="txt">
              <small>{f.label}</small>
              <strong>{count(f.key)}</strong>
            </span>
            {icon("i-chevron-right", 18, 17)}
          </button>
        ))}
      </div>

      <div className="mtable" role="table" aria-label="Workspace members">
        <div className="mrow head" role="row">
          <span role="columnheader">Member</span>
          <span role="columnheader">Workspace role</span>
          <span role="columnheader">Assigned sites</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">
            <span className="sr-only">More</span>
          </span>
        </div>
        <div id="team-rows" role="rowgroup">
          {rows.map((m) => {
            const key = m.userId ?? m.email;
            const name = m.you ? `${m.name} (you)` : m.name || m.email.split("@")[0];
            return (
              <div className="mrow" role="row" key={key}>
                <span className="who" role="cell">
                  <span className="pmark" style={{ "--s": "36px", background: tint(m.email) } as React.CSSProperties} aria-hidden="true">
                    {(m.name || m.email).split(/\s+/).filter(Boolean).map((p) => p[0]?.toUpperCase() ?? "").join("").slice(0, 2).toUpperCase() || "?"}
                  </span>
                  <div>
                    <strong>{name}</strong>
                    <small>{m.email}</small>
                  </div>
                </span>
                <span className="cell" role="cell">
                  <RolePill role={m.role} />
                </span>
                <span className="cell" role="cell">
                  {siteAccessText(m.access, m.siteIds)}
                </span>
                <span className="cell" role="cell">
                  <span className={`status${m.pending ? " pending" : ""}`}>{m.pending ? "Invited" : "Active"}</span>
                </span>
                <span className="menu-cell" role="cell">
                  <button
                    type="button"
                    className="more-btn"
                    aria-label={`More actions for ${name}`}
                    aria-expanded={openMenu === key}
                    onClick={() => setOpenMenu((m2) => (m2 === key ? null : key))}
                  >
                    {icon("i-more")}
                  </button>
                  <div className="more-menu" hidden={openMenu !== key}>
                    {m.you ? (
                      <>
                        <a href="/onboarding/profile?returnTo=/team">Edit your profile</a>
                        <a href="/settings">Workspace settings</a>
                      </>
                    ) : canManage ? (
                      <>
                        <p className="menu-label">Change role</p>
                        {(["administrator", "editor", "viewer"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            aria-current={m.role === r ? "true" : undefined}
                            onClick={() => {
                              setOpenMenu(null);
                              submit(
                                { intent: "set-role", workspaceId, userId: m.userId ?? "", role: r },
                                { method: "post" },
                              );
                            }}
                          >
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                            {m.role === r ? " ✓" : ""}
                          </button>
                        ))}
                        <hr />
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            setOpenMenu(null);
                            setPending(m);
                          }}
                        >
                          Remove from workspace
                        </button>
                      </>
                    ) : (
                      <p className="menu-label">Only owners and admins can change this team.</p>
                    )}
                  </div>
                </span>
              </div>
            );
          })}
          {!rows.length ? (
            <p className="mempty">
              No members match.{" "}
              <button
                type="button"
                className="btn-text"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                Show everyone
              </button>
            </p>
          ) : null}
        </div>
      </div>

      {/* Confirmation for the one destructive action in this view. The
          prototype removes straight from the menu; a real membership row is not
          something to lose to a stray click, and RLS will not offer an undo. */}
      {pending ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="remove-title">
            <div className="modal-head">
              <h2 id="remove-title">Remove {pending.email || "this member"}?</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setPending(null)}>
                {icon("i-close")}
              </button>
            </div>
            <div className="modal-body">
              <p className="muted">
                They lose access to every site in this workspace. This cannot be undone from this screen.
              </p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn-light" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-dark"
                onClick={() => {
                  const target = pending;
                  setPending(null);
                  submit({ intent: "remove-member", workspaceId, userId: target.userId ?? "" }, { method: "post" });
                }}
              >
                Remove member
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}