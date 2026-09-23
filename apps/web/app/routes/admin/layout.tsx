import { Form, Link, NavLink, Outlet, redirect, useLoaderData, useMatches, useParams } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw redirect(`/login?returnTo=${encodeURIComponent(new URL(request.url).pathname)}`);

  return { email: user.email };
}

export default function AdminLayout() {
  const { email } = useLoaderData<typeof loader>();

  const { siteId, pageId } = useParams();
  const matches = useMatches();
  const site = matches.map((match) => (match.loaderData as { site?: { name: string } } | undefined)?.site).find(Boolean);
  const base = siteId ? `/admin/sites/${siteId}` : "/admin";
  if (pageId) return <Outlet />;

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="admin-sidebar">
        <Link to="/admin" className="brand"><span className="brand-mark">D</span><span>Digital Romanian<span className="brand-caption">Site administration</span></span></Link>
        <Link to="/admin" className="site-switcher"><span className="site-monogram">{site?.name?.slice(0, 2).toUpperCase() || "WS"}</span><span>{site?.name || "Your workspace"}<small>Switch site ↕</small></span></Link>
        <div className="nav-label">WORKSPACE</div>
        <nav className="admin-nav" aria-label="Administration">
          <NavLink to={base} end><span aria-hidden="true">▦</span>{siteId ? "Overview" : "All sites"}</NavLink>
          {siteId ? <><Link to={`${base}#pages`}><span aria-hidden="true">▤</span>Website</Link><NavLink to={`${base}/store`}><span aria-hidden="true">▱</span>Store</NavLink><Link to={`${base}#publishing`}><span aria-hidden="true">↗</span>Publishing</Link></> : null}
        </nav>
        <div className="sidebar-bottom"><span className="account-avatar">{email?.slice(0, 1).toUpperCase()}</span><div className="account-details"><span>{email}</span><Form method="post" action="/logout"><button type="submit">Sign out ↗</button></Form></div></div>
      </aside>
      <div className="admin-body"><header className="admin-topbar"><span className="scope-label">{site?.name || "Workspace"}<span>/</span><strong>Administration</strong></span><span className="badge">Staff workspace</span></header><div id="main-content" className="admin-content"><Outlet /></div><footer className="admin-footer">Digital Romanian <span>Make it yours.</span></footer></div>
    </div>
  );
}
