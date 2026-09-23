import { useState } from "react";
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation, useSearchParams } from "react-router";
import { siteAccess } from "~/lib/site-access.server";
import { pageStatus, validatePagePath } from "~/lib/page-model";
import { starterDocument, starters, type StarterId } from "~/lib/component-registry/starters";
import { Dialog } from "~/components/dialog";
import type { Route } from "./+types/pages";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, site, canEdit } = await siteAccess(request, params.siteId);
  const [pagesResult, liveResult] = await Promise.all([
    supabase.from("pages").select("id,title,slug,draft_document,draft_updated_at").eq("site_id", site.id).order("created_at"),
    site.active_release_id ? supabase.from("release_pages").select("page_id,title,slug,document").eq("release_id", site.active_release_id) : Promise.resolve({ data: [], error: null }),
  ]);
  if (pagesResult.error || liveResult.error) throw new Response("Could not load pages. Please retry.", { status: 503 });
  return { site, canEdit, pages: (pagesResult.data ?? []).map(page => ({ ...page, status: pageStatus(page, liveResult.data ?? []) })) };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, site, user, canEdit } = await siteAccess(request, params.siteId);
  if (!canEdit) return { error: "Your role can view pages but cannot change them." };
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const pageId = String(form.get("page_id") || "");
  const title = String(form.get("title") || "").trim();
  const { slug, error: pathError } = validatePagePath(String(form.get("slug") || ""));
  if (["create", "update", "duplicate"].includes(intent)) {
    if (!title || title.length > 200) return { error: "Enter a page title between 1 and 200 characters." };
    if (pathError) return { error: pathError };
  }
  if (intent === "create") {
    const starter = String(form.get("starter") || "blank");
    if (!starters.some(item => item.id === starter)) return { error: "Choose an available starter." };
    const { data, error } = await supabase.from("pages").insert({ site_id: site.id, title, slug, draft_document: starterDocument(starter as StarterId), created_by: user.id }).select("id").single();
    if (error) return { error: error.code === "23505" ? "A page already uses that path." : "Could not create the page. Please retry." };
    return redirect(`/admin/sites/${site.id}/pages/${data.id}`);
  }
  const { data: page } = await supabase.from("pages").select("id,title,draft_document,draft_updated_at").eq("site_id", site.id).eq("id", pageId).maybeSingle();
  if (!page) return { error: "This page is no longer available. Refresh the list." };
  if (intent === "duplicate") {
    const { data, error } = await supabase.from("pages").insert({ site_id: site.id, title, slug, draft_document: page.draft_document, created_by: user.id }).select("id").single();
    if (error) return { error: error.code === "23505" ? "A page already uses that path." : "Could not duplicate the page." };
    return redirect(`/admin/sites/${site.id}/pages/${data.id}`);
  }
  const knownUpdatedAt = String(form.get("known_updated_at") || "");
  if (knownUpdatedAt !== page.draft_updated_at) return { error: "This page changed while you were working. Reload before trying again." };
  if (intent === "update") {
    const { data, error } = await supabase.from("pages").update({ title, slug, draft_updated_at: new Date().toISOString(), draft_updated_by: user.id }).eq("site_id", site.id).eq("id", page.id).eq("draft_updated_at", knownUpdatedAt).select("id").maybeSingle();
    if (error || !data) return { error: error?.code === "23505" ? "A page already uses that path." : "The page could not be updated. It may have changed; reload and try again." };
    return { success: "Page settings saved. Publish the site to make them live." };
  }
  if (intent === "delete") {
    if (String(form.get("confirmation")) !== page.title) return { error: "Type the page title exactly to confirm removal." };
    const { data, error } = await supabase.from("pages").delete().eq("site_id", site.id).eq("id", page.id).eq("draft_updated_at", knownUpdatedAt).select("id").maybeSingle();
    if (error || !data) return { error: "The page could not be removed. Refresh and try again." };
    return { success: "Draft removed. The published page stays live until your next site publication." };
  }
  return { error: "Unknown page action." };
}

export default function Pages() {
  const { site, pages, canEdit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<{ mode: "create" | "update" | "duplicate" | "delete"; page?: typeof pages[number] } | null>(null);
  const query = params.get("q") || "";
  const status = params.get("status") || "all";
  const filtered = pages.filter(page => `${page.title} ${page.slug}`.toLowerCase().includes(query.toLowerCase()) && (status === "all" || page.status === status));
  function filter(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); }
  return <main>
    <div className="page-heading"><div><span className="eyebrow">WEBSITE</span><h1>Pages</h1><p className="muted">Every page, from first draft to live website.</p></div>{canEdit ? <button className="btn" onClick={() => setDialog({ mode: "create" })}>＋ Add page</button> : <span className="badge">Read-only access</span>}</div>
    {actionData && "success" in actionData ? <p role="status" className="alert-success">{actionData.success}</p> : null}
    {!dialog && actionData && "error" in actionData ? <p role="alert" className="alert-error">{actionData.error}</p> : null}
    <div className="filter-bar"><div className="field"><label htmlFor="page-search">Search pages</label><input id="page-search" className="input" value={query} onChange={e => filter("q", e.target.value)} placeholder="Search by title or path…" /></div><div className="field"><label htmlFor="status">Publication status</label><select id="status" className="input" value={status} onChange={e => filter("status", e.target.value)}>{["all", "New page", "Unpublished changes", "Live"].map(value => <option key={value} value={value}>{value === "all" ? "All pages" : value}</option>)}</select></div><span className="muted">{filtered.length} of {pages.length} pages</span></div>
    <section className="card"><ul className="page-manager-list">{filtered.map(page => <li key={page.id}><div><Link className="page-title-link" to={canEdit ? `/admin/sites/${site.id}/pages/${page.id}` : `/admin/sites/${site.id}/preview/${page.id}`}>{page.title}</Link><small>/{page.slug || ""}{!page.slug ? " · Home page" : ""}</small></div><span className={`badge ${page.status === "Live" ? "badge-green" : "badge-amber"}`}>{page.status}</span><div className="row-actions"><Link to={`/admin/sites/${site.id}/preview/${page.id}`} className="btn-secondary">Preview</Link>{canEdit ? <details className="row-menu"><summary aria-label={`Actions for ${page.title}`}>•••</summary><div><button onClick={() => setDialog({ mode: "update", page })}>Page settings</button><button onClick={() => setDialog({ mode: "duplicate", page })}>Duplicate page</button><button onClick={() => setDialog({ mode: "delete", page })}>Remove draft</button></div></details> : null}</div></li>)}</ul>{filtered.length === 0 ? <div className="empty-state"><h2>{pages.length ? "No matching pages" : "Your website starts here"}</h2><p>{pages.length ? "Try another search or status filter." : "Create a blank page or choose an optional starter."}</p></div> : null}</section>
    {dialog ? <Dialog title={dialog.mode === "create" ? "Create a page" : dialog.mode === "delete" ? "Remove draft page" : dialog.mode === "duplicate" ? "Duplicate page" : "Page settings"} onClose={() => setDialog(null)}><Form method="post" key={`${dialog.mode}-${dialog.page?.id}`}>
      <input type="hidden" name="intent" value={dialog.mode} /><input type="hidden" name="page_id" value={dialog.page?.id || ""} /><input type="hidden" name="known_updated_at" value={dialog.page?.draft_updated_at || ""} />
      {dialog.mode === "delete" ? <><p className="section-copy">This permanently removes the editable draft. Existing published releases stay intact. The page disappears from the live site only after the next publication.</p><div className="field"><label htmlFor="confirmation">Type “{dialog.page?.title}” to confirm</label><input id="confirmation" name="confirmation" className="input" required autoComplete="off" /></div></> : <><div className="field"><label htmlFor="title">Page title</label><input autoFocus id="title" name="title" className="input" required maxLength={200} defaultValue={dialog.mode === "duplicate" ? `${dialog.page?.title} (copy)` : dialog.page?.title} /></div><div className="field"><label htmlFor="slug">Page path</label><input id="slug" name="slug" className="input" defaultValue={dialog.mode === "duplicate" ? `${dialog.page?.slug || "home"}-copy` : dialog.page?.slug} placeholder="about-us" /><small className="muted">Leave blank for the home page. Changing a live path does not create a redirect.</small></div>{dialog.mode === "create" ? <fieldset className="starter-options"><legend>Start with</legend>{starters.map(starter => <label key={starter.id}><input type="radio" name="starter" value={starter.id} defaultChecked={starter.id === "blank"} /><span><strong>{starter.name}</strong><small>{starter.description}</small></span></label>)}</fieldset> : null}</>}
      {actionData && "error" in actionData ? <p role="alert" className="alert-error">{actionData.error}</p> : null}
      {actionData && "success" in actionData ? <p role="status" className="alert-success">{actionData.success}</p> : null}
      <div className="dialog-actions"><button type="button" className="btn-secondary" onClick={() => setDialog(null)}>Close</button><button className="btn" disabled={busy}>{busy ? "Saving…" : dialog.mode === "delete" ? "Remove draft" : dialog.mode === "create" ? "Create & edit" : dialog.mode === "duplicate" ? "Duplicate & edit" : "Save settings"}</button></div>
    </Form></Dialog> : null}
  </main>;
}
