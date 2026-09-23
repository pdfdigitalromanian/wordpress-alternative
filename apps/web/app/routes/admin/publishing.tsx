import { createHash } from "node:crypto";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { siteAccess } from "~/lib/site-access.server";
import { canonical, pageStatus, validatePagePath } from "~/lib/page-model";
import type { Route } from "./+types/publishing";

async function publishingData(request: Request, siteId: string) {
  const access = await siteAccess(request, siteId);
  const { supabase, site } = access;
  const [drafts, released, history] = await Promise.all([
    supabase.from("pages").select("id,title,slug,draft_document,draft_updated_at").eq("site_id", site.id).order("id"),
    site.active_release_id ? supabase.from("release_pages").select("id,page_id,title,slug,document").eq("release_id", site.active_release_id) : Promise.resolve({ data: [], error: null }),
    supabase.from("releases").select("id,label,created_at").eq("site_id", site.id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (drafts.error || released.error || history.error) throw new Response("Publishing information is unavailable. Please retry.", { status: 503 });
  const pages = (drafts.data ?? []).map(page => ({ ...page, status: pageStatus(page, released.data ?? []) }));
  const removed = (released.data ?? []).filter(page => !pages.some(draft => draft.id === page.page_id));
  const reviewToken = createHash("sha256").update(canonical({ pages: drafts.data, active: site.active_release_id })).digest("hex");
  return { ...access, pages, removed, releases: history.data ?? [], reviewToken };
}
export async function loader({ request, params }: Route.LoaderArgs) {
  const { site, canEdit, pages, removed, releases, reviewToken } = await publishingData(request, params.siteId);
  return { site, canEdit, pages: pages.map(({ draft_document: _doc, ...page }) => page), removed: removed.map(({ document: _doc, ...page }) => page), releases, reviewToken };
}
export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, site, canEdit, pages, reviewToken } = await publishingData(request, params.siteId);
  if (!canEdit) return { error: "Your role cannot publish or restore this site." };
  const form = await request.formData();
  if (String(form.get("review_token")) !== reviewToken) return { error: "The site's drafts or live release changed. Review the refreshed list and try again." };
  if (form.get("intent") === "publish") {
    if (!pages.length) return { error: "Create a page before publishing." };
    if (!pages.some(page => page.slug === "")) return { error: "Choose a home page by setting its path to blank before publishing." };
    if (pages.some(page => validatePagePath(page.slug).error)) return { error: "A page uses an invalid or reserved path. Fix it in Pages before publishing." };
    if (form.get("confirmed") !== "yes") return { error: "Confirm that you reviewed all site drafts." };
    const { error } = await supabase.rpc("publish_site", { target_site_id: site.id, release_label: String(form.get("label") || "").trim().slice(0, 200) || undefined });
    return error ? { error: "Publication failed. Your drafts are safe; refresh to check the live release before retrying." } : { success: "Your website is now live on the new release." };
  }
  if (form.get("intent") === "restore") {
    if (form.get("confirmation") !== site.name) return { error: "Type the site name exactly to confirm the live release change." };
    const { error } = await supabase.rpc("rollback_site", { target_site_id: site.id, target_release_id: String(form.get("release_id")) });
    return error ? { error: "Could not restore this release. Refresh and try again." } : { success: "The selected release is live. Your current drafts are unchanged." };
  }
  return { error: "Unknown publishing action." };
}
export default function Publishing() {
  const { site, canEdit, pages, removed, releases, reviewToken } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  const changed = pages.filter(page => page.status !== "Live");
  return <main><div className="page-heading"><div><span className="eyebrow">PUBLISHING</span><h1>Review your website</h1><p className="muted">One release. Every page. A clear view of what changes.</p></div><span className="badge badge-amber">{changed.length + removed.length} pending changes</span></div>
    {result && "error" in result ? <p className="alert-error" role="alert">{result.error}</p> : null}{result && "success" in result ? <p className="alert-success" role="status">{result.success}</p> : null}
    <div className="overview-grid"><section className="card"><h2>Pages in the next release</h2><p className="section-copy muted">Publishing includes every current draft, including edits made by other team members. Prices, stock, products, and orders stay in Medusa.</p><ul className="page-manager-list">{pages.map(page => <li key={page.id}><div><strong>{page.title}</strong><small>/{page.slug}</small></div><span className={`badge ${page.status === "Live" ? "badge-green" : "badge-amber"}`}>{page.status}</span><Link className="text-link" to={`/admin/sites/${site.id}/preview/${page.id}`}>Preview</Link></li>)}{removed.map(page => <li key={page.id}><div><strong>{page.title}</strong><small>/{page.slug}</small></div><span className="badge badge-amber">Removed next release</span></li>)}</ul>{!pages.length ? <div className="empty-state"><p>No pages yet.</p><Link to={`/admin/sites/${site.id}/pages`} className="btn">Create a page</Link></div> : null}</section>
    <aside><section className="card"><h2>Publish site</h2><Form method="post"><input type="hidden" name="intent" value="publish" /><input type="hidden" name="review_token" value={reviewToken} /><div className="field"><label htmlFor="label">Release name</label><input id="label" name="label" maxLength={200} className="input" placeholder="e.g. Autumn update" /></div><label className="check-label"><input name="confirmed" type="checkbox" value="yes" required />I reviewed all page drafts and want to make this website live.</label><button className="btn" disabled={!canEdit || busy || !pages.length}>{busy ? "Please wait…" : "Publish site"}</button>{!canEdit ? <p className="muted section-copy">Your role has read-only access.</p> : null}</Form></section><section className="dark-card"><h2>Your drafts are safe.</h2><p>Publishing creates a separate snapshot. Later edits stay private until you publish again.</p><p>Restoring a release changes the live presentation without overwriting your drafts.</p></section></aside></div>
    <section className="card"><h2>Release history</h2>{releases.length ? <ul className="release-list">{releases.map(release => <li key={release.id}><div className="section-heading"><div><strong>{release.label || "Website release"}</strong><small>{new Date(release.created_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</small></div>{release.id === site.active_release_id ? <span className="badge badge-green">● Live</span> : null}</div>{canEdit && release.id !== site.active_release_id ? <details><summary>Restore this release</summary><Form method="post" className="form-row"><input type="hidden" name="intent" value="restore" /><input type="hidden" name="release_id" value={release.id} /><input type="hidden" name="review_token" value={reviewToken} /><div className="field"><label htmlFor={`restore-${release.id}`}>Type “{site.name}” to change the live website</label><input id={`restore-${release.id}`} name="confirmation" className="input" required /></div><button className="btn-secondary" disabled={busy}>Restore live release</button></Form></details> : null}</li>)}</ul> : <p className="muted">Your first release will appear here after publishing.</p>}</section>
  </main>;
}
