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

  return { site, pages: pages ?? [], releases: releases ?? [], domains: domains ?? [] };
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
  const { site, pages, releases, domains } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <main>
      <p className="mb-2 text-sm">
        <Link to="/admin" className="text-gray-600 hover:underline dark:text-gray-400">
          ← Overview
        </Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">{site.name}</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        {site.active_release_id ? (
          <>Published — active release <code>{site.active_release_id.slice(0, 8)}</code></>
        ) : (
          "Not published yet"
        )}
        {domains.length > 0 ? (
          <>
            {" · "}
            {domains.map((d) => `${d.hostname}${d.verified_at ? "" : " (unverified)"}`).join(", ")}
          </>
        ) : null}
      </p>

      <section className="card">
        <h2 className="mb-3 text-lg font-medium">Pages</h2>
        {pages.length === 0 ? (
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">No pages yet.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {pages.map((page) => (
              <li key={page.id}>
                <Link to={`/admin/sites/${site.id}/pages/${page.id}`} className="hover:underline">
                  {page.title}
                </Link>{" "}
                <code className="text-sm text-gray-500">(/{page.slug})</code>
              </li>
            ))}
          </ul>
        )}

        <Form method="post" className="flex items-end gap-2">
          <input type="hidden" name="intent" value="create-page" />
          <div className="field mb-0">
            <label htmlFor="title">Title</label>
            <input id="title" name="title" type="text" required className="input" />
          </div>
          <div className="field mb-0">
            <label htmlFor="slug">Path (blank = home page)</label>
            <input id="slug" name="slug" type="text" placeholder="about" className="input" />
          </div>
          <button type="submit" disabled={submitting} className="btn">
            Add page
          </button>
        </Form>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-medium">Publish</h2>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Publishing snapshots every page's current draft into a new, immutable release and makes it
          live. Editing a draft afterward never changes what's already published.
        </p>
        <Form method="post" className="flex items-end gap-2">
          <input type="hidden" name="intent" value="publish" />
          <div className="field mb-0 flex-1">
            <label htmlFor="label">Release label (optional)</label>
            <input id="label" name="label" type="text" className="input" placeholder="e.g. launch copy" />
          </div>
          <button type="submit" disabled={submitting} className="btn">
            Publish now
          </button>
        </Form>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-medium">Release history</h2>
        {releases.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">No releases yet.</p>
        ) : (
          <ul className="space-y-2">
            {releases.map((release) => (
              <li key={release.id} className="flex items-center gap-2 text-sm">
                <span className={release.id === site.active_release_id ? "font-semibold" : ""}>
                  {release.label || "(untitled release)"} — {new Date(release.created_at).toLocaleString()}
                  {release.id === site.active_release_id ? " · live" : ""}
                </span>
                {release.id !== site.active_release_id ? (
                  <Form method="post" className="inline">
                    <input type="hidden" name="intent" value="rollback" />
                    <input type="hidden" name="release_id" value={release.id} />
                    <button type="submit" disabled={submitting} className="btn-secondary">
                      Roll back to this
                    </button>
                  </Form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {actionData && "error" in actionData ? <p className="alert-error">{actionData.error}</p> : null}
      {actionData && "success" in actionData ? <p className="alert-success">Done.</p> : null}
    </main>
  );
}
