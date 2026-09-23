import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/site";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const siteId = params.siteId!;

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, name, slug, active_release_id")
    .eq("id", siteId)
    .single();
  if (siteError || !site) throw new Response("Site not found", { status: 404 });

  const { data: pages, error: pagesError } = await supabase
    .from("pages")
    .select("id, slug, title, draft_updated_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: true });
  if (pagesError) throw new Response(pagesError.message, { status: 500 });

  const { data: releases, error: releasesError } = await supabase
    .from("releases")
    .select("id, label, created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (releasesError) throw new Response(releasesError.message, { status: 500 });

  const { data: domains } = await supabase
    .from("site_domains")
    .select("hostname, verified_at")
    .eq("site_id", siteId);

  const currentUrl = new URL(request.url);
  const liveDomain = domains?.find((domain) => domain.verified_at);
  const liveUrl = liveDomain ? (["localhost", "127.0.0.1", "[::1]"].includes(liveDomain.hostname) ? `${currentUrl.origin}/?view=live` : `https://${liveDomain.hostname}`) : null;
  return { liveUrl, site, pages: pages ?? [], releases: releases ?? [], domains: domains ?? [] };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const siteId = params.siteId!;
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "create-page") {
    const title = String(formData.get("title") ?? "").trim();
    const rawSlug = String(formData.get("slug") ?? "").trim();
    if (!title) return { intent, error: "Page title is required." };

    // Empty slug is the site's home page ("/"); anything else is slugified.
    const slug = rawSlug === "" ? "" : slugify(rawSlug);
    if (rawSlug !== "" && !slug) return { intent, error: "Could not derive a valid slug from that." };

    const { error } = await supabase.from("pages").insert({
      site_id: siteId,
      slug,
      title,
      created_by: user.id,
    });
    if (error) {
      if (error.code === "23505") return { intent, error: "A page with that path already exists on this site." };
      return { intent, error: error.message };
    }
    return { intent, success: true };
  }

  if (intent === "publish") {
    const label = String(formData.get("label") ?? "").trim() || undefined;
    const { data, error } = await supabase.rpc("publish_site", { target_site_id: siteId, release_label: label });
    if (error) return { intent, error: error.message };
    return { intent, success: true, releaseId: data?.id };
  }

  if (intent === "rollback") {
    const releaseId = String(formData.get("release_id") ?? "");
    if (!releaseId) return { intent, error: "Missing release." };
    const { error } = await supabase.rpc("rollback_site", { target_site_id: siteId, target_release_id: releaseId });
    if (error) return { intent, error: error.message };
    return { intent, success: true };
  }

  return { intent, error: "Unknown action." };
}

export default function SiteDetail() {
  const { liveUrl, site, pages, releases, domains } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const liveDomain = domains.find((domain) => domain.verified_at);
  const activeRelease = releases.find((release) => release.id === site.active_release_id);
  const tasks = [
    { title: "Create your first page", description: "Start with a blank canvas and make it yours.", done: pages.length > 0, href: "#pages" },
    { title: "Connect a domain", description: "Give your website a place to call home.", done: Boolean(liveDomain), href: "/admin" },
    { title: "Publish your website", description: "Review your pages and share them with the world.", done: Boolean(site.active_release_id), href: "#publishing" },
  ];
  const complete = tasks.filter((task) => task.done).length;
  return (
    <main>
      <div className="page-heading"><div><span className="eyebrow">YOUR WEBSITE AT A GLANCE</span><h1>Overview</h1></div><div className="heading-actions"><a className="btn" href={pages[0] ? `/admin/sites/${site.id}/pages/${pages[0].id}` : "#pages"}>↗ Edit website</a>{site.active_release_id && liveDomain ? <a className="btn-secondary" href={liveUrl!} target="_blank" rel="noreferrer">View live ↗</a> : <span className="muted text-sm">{site.active_release_id ? "Connect a verified domain to view live" : "Publish to get a live website"}</span>}</div></div>
      <div className="site-identity"><strong>{site.name}</strong><span className="muted">{domains[0]?.hostname || "No domain connected"}</span><span className={`badge ${site.active_release_id ? "badge-green" : "badge-amber"}`}>{site.active_release_id ? "● Live" : "○ Not published"}</span></div>
      <div className="notice-banner"><span className="notice-icon" aria-hidden="true">▤</span><div><strong>Your next chapter starts with a draft.</strong><p>Changes stay private until you publish. Publishing includes every page in this site.</p></div><a href="#publishing" className="btn-secondary">Review & publish →</a></div>
      {actionData && "error" in actionData ? <p role="alert" className="alert-error">{actionData.error}</p> : null}
      {actionData && "success" in actionData ? <p role="status" className="alert-success">Changes saved successfully.</p> : null}
      <div className="overview-grid"><div>
        <section className="card"><div className="section-heading"><div><span className="eyebrow">GETTING STARTED</span><h2>Continue setup</h2></div><span className="muted text-sm">{complete} of 3 complete</span></div><progress className="setup-progress" value={complete} max={3} aria-label="Site setup progress" />
          <ul className="task-list">{tasks.map((task) => <li key={task.title}><span className={`task-icon ${task.done ? "complete" : ""}`}>{task.done ? "✓" : "↗"}</span><div><strong>{task.title}</strong><p>{task.description}</p></div><a href={task.href}>{task.done ? "View" : "Continue"} →</a></li>)}</ul>
        </section>
        <section className="card" id="pages"><div className="section-heading"><div><span className="eyebrow">WEBSITE</span><h2>Your pages</h2></div><span className="badge">{pages.length} pages</span></div>
          {pages.length === 0 ? <div className="empty-state"><span aria-hidden="true">▤</span><h3>A blank canvas. Endless possibilities.</h3><p>Create your first page below. Add only what you need.</p></div> : <ul className="page-list">{pages.map((page) => <li key={page.id}><span className="page-icon" aria-hidden="true">▤</span><div><Link to={`/admin/sites/${site.id}/pages/${page.id}`}>{page.title}</Link><small>/{page.slug}</small></div><span className="badge">Draft</span><Link className="row-action" to={`/admin/sites/${site.id}/pages/${page.id}`}>Edit →</Link></li>)}</ul>}
          <details className="inline-details" open={pages.length === 0}><summary>Add a page <span>＋</span></summary><Form method="post" className="form-row"><input type="hidden" name="intent" value="create-page" /><div className="field"><label htmlFor="title">Page title</label><input id="title" name="title" required className="input" placeholder="e.g. Home" /></div><div className="field"><label htmlFor="slug">Path (blank for home)</label><input id="slug" name="slug" className="input" placeholder="about" /></div><button disabled={submitting} className="btn">Add page</button></Form></details>
        </section>
        <section className="card" id="publishing"><span className="eyebrow">READY WHEN YOU ARE</span><h2>Publish your changes</h2><p className="muted section-copy">All current page drafts become the live site. Store products, prices, inventory, and orders are unaffected.</p><Form method="post" className="form-row" onSubmit={(event) => { if (!window.confirm(`Publish all ${pages.length} page drafts on ${site.name}? This replaces the current live presentation.`)) event.preventDefault(); }}><input type="hidden" name="intent" value="publish" /><div className="field"><label htmlFor="label">Release label (optional)</label><input id="label" name="label" className="input" placeholder="e.g. A fresh start" /></div><button disabled={submitting || pages.length === 0} className="btn">{submitting ? "Please wait…" : "Publish site"}</button></Form>{pages.length === 0 ? <p className="muted text-sm">Create a page before publishing.</p> : null}</section>
      </div><aside className="overview-aside">
        <section className="card"><span className="eyebrow">LAST PUBLISHED</span><h2>Your live release</h2>{activeRelease ? <div className="release-preview"><span className="badge badge-green">● Live</span><h3>{activeRelease.label || "Website release"}</h3><p>{new Date(activeRelease.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</p></div> : <div className="release-preview"><span className="badge">Not published</span><h3>A home for your first release.</h3><p>Once you publish, your live release will appear here.</p></div>}</section>
        <section className="dark-card"><span className="eyebrow">A LITTLE CLARITY</span><h2>Draft. Publish. Repeat.</h2><p><strong>Drafts are your workspace.</strong> Edit freely. Your visitors keep seeing the last published release.</p><p><strong>Publishing is site-wide.</strong> Review every page before making your changes live.</p><p><strong>Previous releases stay here.</strong> Restore a published version when you need to.</p></section>
        <section className="card"><span className="eyebrow">PUBLISHING</span><h2>Release history</h2>{releases.length === 0 ? <p className="muted section-copy">No releases yet. Your story starts with the first publish.</p> : <ul className="release-list">{releases.map((release) => <li key={release.id}><strong>{release.label || "Website release"}</strong><small>{new Date(release.created_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}</small>{release.id === site.active_release_id ? <span className="badge badge-green">Live</span> : <Form method="post" onSubmit={(event) => { if (!window.confirm("Restore this release as the live site? Current drafts will stay unchanged.")) event.preventDefault(); }}><input type="hidden" name="intent" value="rollback" /><input type="hidden" name="release_id" value={release.id} /><button disabled={submitting} className="text-link">Restore release ↗</button></Form>}</li>)}</ul>}</section>
      </aside></div>
    </main>
  );
}
