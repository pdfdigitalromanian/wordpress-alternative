import { useEffect, useState } from "react";
import { Link, Outlet, redirect, useLoaderData, useMatches, useParams } from "react-router";
import { WorkspaceSidebar, type SidebarNavItem } from "~/components/workspace-sidebar";
import { siteAccess } from "~/lib/site-access.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { loadWorkspaceScreen } from "~/lib/workspace.server";
import type { Route } from "./+types/layout";

/* The same four rows the workspace screen shows, from its VIEWS map: All sites,
   Templates, Team, General settings. The old admin-only nav (Overview /
   Website / Store / Publishing) is gone; the per-site editor rows live in the
   page's own header, and the section list is the one the prototype declares. */
const NAV: SidebarNavItem[] = [
  { to: "/workspace", label: "All sites", icon: "i-grid", end: true },
  { to: "/templates", label: "Templates", icon: "i-template" },
  { to: "/team", label: "Team", icon: "i-team" },
  { to: "/settings", label: "Settings", icon: "i-settings" },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw redirect(`/login?returnTo=${encodeURIComponent(new URL(request.url).pathname)}`);

  const access = params.siteId ? await siteAccess(request, params.siteId) : null;
  // The sidebar is the shared workspace one, so the shell needs the same
  // workspace/site/member data the /workspace loader builds.
  const screen = await loadWorkspaceScreen(request);
  return { email: user.email, canManage: access?.canManage ?? false, screen };
}

export function headers() { return { "Cache-Control": "private, no-store" }; }

/** state.currentId in the standalone file, persisted exactly as the workspace
 *  screen does so the choice is shared by /workspace, /overview and /admin. */
function useWorkspaceSelection(data: { workspaces: { id: string }[] }) {
  const [currentId, setCurrentId] = useState<string | null>(data.workspaces[0]?.id ?? null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("dr-current-workspace");
      if (stored && data.workspaces.some((w) => w.id === stored)) setCurrentId(stored);
    } catch {
      /* private mode: the in-memory choice still works */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    currentId,
    switchTo: (id: string) => {
      setCurrentId(id);
      try {
        window.localStorage.setItem("dr-current-workspace", id);
      } catch {
        /* private mode */
      }
    },
  };
}

export default function AdminLayout() {
  const { screen } = useLoaderData<typeof loader>();

  const { pageId, previewId } = useParams();
  const matches = useMatches();
  const site = matches.map((match) => (match.loaderData as { site?: { name: string } } | undefined)?.site).find(Boolean);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const { currentId, switchTo } = useWorkspaceSelection(screen);
  if (pageId || previewId) return <Outlet />;

  const workspaceName = site?.name || "Your workspace";

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>

      {/* The workspace sidebar, verbatim, replacing the old admin sidebar and
          the duplicate copy of it in the mobile drawer. */}
      <WorkspaceSidebar
        data={screen}
        navItems={NAV}
        activeKey={NAV[0].label}
        currentId={currentId}
        onSwitch={switchTo}
        onOpenCreateWs={() => {}}
        onOpenInvite={() => {}}
        open={menuOpen}
        onClose={closeMenu}
      />
      <div className={`scrim${menuOpen ? " show" : ""}`} onClick={closeMenu} />

      <div className="admin-mobilebar">
        <button type="button" className="menu-toggle" aria-expanded={menuOpen} aria-label="Toggle navigation menu" onClick={() => setMenuOpen(menuOpen => !menuOpen)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
        <span className="mobile-brand"><span className="brand-mark">D</span><span>{workspaceName}</span></span>
      </div>

      <div className="admin-body"><header className="admin-topbar"><span className="scope-label">{workspaceName}<span>/</span><strong>Administration</strong></span><Link to="/admin" className="btn btn-staff">Staff workspace</Link></header><div id="main-content" className="admin-content"><Outlet /></div><footer className="admin-footer">Digital Romanian <span>Make it yours.</span></footer></div>
    </div>
  );
}
