import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/index";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  // RLS already restricts every level of this to what the signed-in user
  // is a member of / has access to — no explicit filter needed or
  // trusted from the client.
  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select(
      "id, name, slug, created_at, sites(id, name, slug, created_at, site_domains(id, hostname, is_primary, verified_at))",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Response(error.message, { status: 500 });

  return { workspaces: workspaces ?? [] };
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "create-workspace") {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { intent, error: "Workspace name is required." };

    const slug = slugify(name);
    if (!slug) return { intent, error: "Could not derive a valid slug from that name." };

    const { error } = await supabase.from("workspaces").insert({ name, slug, created_by: user.id });
    if (error) {
      if (error.code === "23505") return { intent, error: "A workspace with that slug already exists." };
      return { intent, error: error.message };
    }
    return { intent, success: true };
  }

  if (intent === "create-site") {
    const workspaceId = String(formData.get("workspace_id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    if (!workspaceId || !name) return { intent, error: "Workspace and site name are required." };

    const slug = slugify(name);
    if (!slug) return { intent, error: "Could not derive a valid slug from that name." };

    const { error } = await supabase.from("sites").insert({ workspace_id: workspaceId, name, slug });
    if (error) {
      if (error.code === "23505") return { intent, error: "This workspace already has a site with that slug." };
      return { intent, error: error.message };
    }
    return { intent, success: true };
  }

  if (intent === "add-domain") {
    const siteId = String(formData.get("site_id") ?? "");
    const hostname = String(formData.get("hostname") ?? "")
      .trim()
      .toLowerCase();
    if (!siteId || !hostname) return { intent, error: "Site and hostname are required." };

    const { error } = await supabase.from("site_domains").insert({ site_id: siteId, hostname });
    if (error) {
      if (error.code === "23505") return { intent, error: "That hostname is already registered." };
      return { intent, error: error.message };
    }
    return { intent, success: true };
  }

  if (intent === "verify-domain") {
    const domainId = String(formData.get("domain_id") ?? "");
    if (!domainId) return { intent, error: "Missing domain." };

    const { error } = await supabase
      .from("site_domains")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", domainId);
    if (error) return { intent, error: error.message };
    return { intent, success: true };
  }

  return { intent, error: "Unknown action." };
}

export default function AdminOverview() {
  const { workspaces } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <main>
      <h1 className="mb-6 text-2xl font-semibold">Overview</h1>

      <section>
        <h2 className="mb-3 text-lg font-medium">Your workspaces</h2>
        {workspaces.length === 0 ? (
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
            No workspaces yet. Create one below.
          </p>
        ) : null}

        {workspaces.map((workspace) => (
          <div key={workspace.id} className="card">
            <h3 className="mb-3 text-base font-semibold">
              {workspace.name} <code className="text-sm font-normal text-gray-500">({workspace.slug})</code>
            </h3>

            {workspace.sites.length === 0 ? (
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">No sites in this workspace yet.</p>
            ) : null}

            <ul className="mb-4 space-y-4">
              {workspace.sites.map((site) => (
                <li key={site.id} className="rounded-md bg-gray-50 p-3 dark:bg-gray-900">
                  <div className="mb-2">
                    <strong>{site.name}</strong>{" "}
                    <code className="text-sm text-gray-500">({site.slug})</code>
                  </div>

                  <ul className="mb-3 space-y-1 text-sm">
                    {site.site_domains.map((domain) => (
                      <li key={domain.id} className="flex items-center gap-2">
                        <span>{domain.hostname}</span>
                        {domain.verified_at ? (
                          <span className="text-green-700 dark:text-green-400">— verified</span>
                        ) : (
                          <>
                            <span className="text-amber-700 dark:text-amber-400">— not verified</span>
                            <Form method="post" action="?index" className="inline">
                              <input type="hidden" name="intent" value="verify-domain" />
                              <input type="hidden" name="domain_id" value={domain.id} />
                              <button type="submit" disabled={submitting} className="btn-secondary">
                                Mark verified (manual — no DNS check yet)
                              </button>
                            </Form>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>

                  <Form method="post" action="?index" className="flex items-end gap-2">
                    <input type="hidden" name="intent" value="add-domain" />
                    <input type="hidden" name="site_id" value={site.id} />
                    <div className="field mb-0 flex-1">
                      <label>
                        Add domain (e.g. <code>localhost</code>, or your production hostname)
                      </label>
                      <input name="hostname" type="text" required placeholder="localhost" className="input" />
                    </div>
                    <button type="submit" disabled={submitting} className="btn-secondary">
                      Add domain
                    </button>
                  </Form>
                </li>
              ))}
            </ul>

            <Form method="post" action="?index" className="flex items-end gap-2">
              <input type="hidden" name="intent" value="create-site" />
              <input type="hidden" name="workspace_id" value={workspace.id} />
              <div className="field mb-0 flex-1">
                <label>New site name</label>
                <input name="name" type="text" required className="input" />
              </div>
              <button type="submit" disabled={submitting} className="btn-secondary">
                Add site
              </button>
            </Form>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-medium">Create a workspace</h2>
        {/* Nested index routes need the `?index` marker so the form
            posts to this route's action rather than the parent layout's
            (which has none) — a known React Router quirk. */}
        <Form method="post" action="?index" className="flex items-end gap-2">
          <input type="hidden" name="intent" value="create-workspace" />
          <div className="field mb-0 flex-1">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" required className="input" />
          </div>
          <button type="submit" disabled={submitting} className="btn">
            {submitting ? "Creating…" : "Create workspace"}
          </button>
        </Form>
      </section>

      {actionData && "error" in actionData ? <p className="alert-error">{actionData.error}</p> : null}
      {actionData && "success" in actionData ? <p className="alert-success">Done.</p> : null}
    </main>
  );
}
