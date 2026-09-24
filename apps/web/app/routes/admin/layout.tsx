import { useState } from "react";
import { Form, Link, NavLink, Outlet, redirect, useLoaderData, useMatches, useParams } from "react-router";
import { siteAccess } from "~/lib/site-access.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/layout";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw redirect(`/login?returnTo=${encodeURIComponent(new URL(request.url).pathname)}`);

  const access = params.siteId ? await siteAccess(request, params.siteId) : null;
  return { email: user.email, canManage: access?.canManage ?? false };
}

export function headers() { return { "Cache-Control": "private, no-store" }; }

export default function AdminLayout() {
  const { email, canManage } = useLoaderData<typeof loader>();

  const { siteId, pageId, previewId } = useParams();
  const matches = useMatches();
  const site = matches.map((match) => (match.loaderData as { site?: { name: string } } | undefined)?.site).find(Boolean);
  const base = siteId ? `/admin/sites/${siteId}` : "/admin";
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  if (pageId || previewId) return <Outlet />;

  const workspaceName = site?.name || "Your workspace";
  const navItems = [
    { to: base, end: true, icon: "▦", label: siteId ? "Overview" : "All sites" },
    ...(siteId
      ? [
          { to: `${base}/pages`, end: false, icon: "▤", label: "Website" },
          ...(canManage ? [{ to: `${base}/store`, end: false, icon: "▱", label: "Store" }] : []),
          { to: `${base}/publishing`, end: false, icon: "↗", label: "Publishing" },
        ]
      : []),
  ] as { to: string; end: boolean; icon: string; label: string }[];

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="admin-sidebar">
        <Link to="/admin" className="brand"><span className="brand-mark">D</span><span>Digital Romanian<span className="brand-caption">Site administration</span></span></Link>
        <Link to="/admin" className="site-switcher"><span className="site-monogram">{site?.name?.slice(0, 2).toUpperCase() || "WS"}</span><span>{workspaceName}<small>Switch site ↕</small></span></Link>
        <div className="nav-label">WORKSPACE</div>
        <nav className="admin-nav" aria-label="Administration">
          {navItems.map((item) => <NavLink key={item.label} to={item.to} end={item.end}><span aria-hidden="true">{item.icon}</span>{item.label}</NavLink>)}
        </nav>
        <div className="sidebar-bottom"><span className="account-avatar">{email?.slice(0, 1).toUpperCase()}</span><div className="account-details"><span>{email}</span><Form method="post" action="/logout"><button type="submit">Sign out ↗</button></Form></div></div>
      </aside>

      <div className="admin-mobilebar">
        <Link to="/admin" className="mobile-brand" onClick={closeMenu}><span className="brand-mark">D</span><span>{workspaceName}</span></Link>
        <button type="button" className="menu-toggle" aria-expanded={menuOpen} aria-label="Toggle navigation menu" onClick={() => setMenuOpen(menuOpen => !menuOpen)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
      </div>
      <div className={`admin-drawer${menuOpen ? " open" : ""}`} aria-hidden={!menuOpen} aria-label="Navigation menu">
        <div className="drawer-scrim" onClick={closeMenu} />
        <div className="drawer-panel">
          <Link to="/admin" className="mobile-brand" onClick={closeMenu}><span className="brand-mark">D</span><span>Digital Romanian</span></Link>
          <Link to="/admin" className="site-switcher" onClick={closeMenu}><span className="site-monogram">{site?.name?.slice(0, 2).toUpperCase() || "WS"}</span><span>{workspaceName}<small>Switch site ↕</small></span></Link>
          <div className="nav-label">WORKSPACE</div>
          <nav className="admin-nav" aria-label="Administration">
{navItems.map((item) => <NavLink key={item.label} to={item.to} end={item.end} onClick={closeMenu}><span aria-hidden="true">{item.icon}</span>{item.label}</NavLink>)}
        </nav>
          <Link to="/admin" className="drawer-staff" onClick={closeMenu}><span>Staff workspace</span><span aria-hidden="true">→</span></Link>
          <div className="drawer-account">
            <div className="drawer-account-user"><span className="account-avatar">{email?.slice(0, 1).toUpperCase()}</span><span className="drawer-email">{email}</span></div>
            <Form method="post" action="/logout"><button type="submit" className="btn-secondary drawer-signout" onClick={closeMenu}>Sign out ↗</button></Form>
          </div>
        </div>
      </div>

      <div className="admin-body"><header className="admin-topbar"><span className="scope-label">{workspaceName}<span>/</span><strong>Administration</strong></span><Link to="/admin" className="btn btn-staff">Staff workspace</Link></header><div id="main-content" className="admin-content"><Outlet /></div><footer className="admin-footer">Digital Romanian <span>Make it yours.</span></footer></div>
    </div>
  );
}
