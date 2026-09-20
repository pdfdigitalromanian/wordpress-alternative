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
      <h1>Overview</h1>

      <section>
        <h2>Your workspaces</h2>
        {workspaces.length === 0 ? <p>No workspaces yet. Create one below.</p> : null}

        {workspaces.map((workspace) => (
          <div key={workspace.id}>
            <h3>
              {workspace.name} <code>({workspace.slug})</code>
            </h3>

            {workspace.sites.length === 0 ? <p>No sites in this workspace yet.</p> : null}
            <ul>
              {workspace.sites.map((site) => (
                <li key={site.id}>
                  <strong>{site.name}</strong> <code>({site.slug})</code>
                  <ul>
                    {site.site_domains.map((domain) => (
                      <li key={domain.id}>
                        {domain.hostname}{" "}
                        {domain.verified_at ? (
                          "— verified"
                        ) : (
                          <>
                            — not verified{" "}
                            <Form method="post" action="?index" style={{ display: "inline" }}>
                              <input type="hidden" name="intent" value="verify-domain" />
                              <input type="hidden" name="domain_id" value={domain.id} />
                              <button type="submit" disabled={submitting}>
                                Mark verified (manual — no DNS check yet)
                              </button>
                            </Form>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Form method="post" action="?index">
                    <input type="hidden" name="intent" value="add-domain" />
                    <input type="hidden" name="site_id" value={site.id} />
                    <label>
                      Add domain (e.g. <code>localhost</code> for local dev, or your production
                      hostname)
                      <input name="hostname" type="text" required placeholder="localhost" />
                    </label>
                    <button type="submit" disabled={submitting}>
                      Add domain
                    </button>
                  </Form>
                </li>
              ))}
            </ul>

            <Form method="post" action="?index">
              <input type="hidden" name="intent" value="create-site" />
              <input type="hidden" name="workspace_id" value={workspace.id} />
              <label>
                New site name
                <input name="name" type="text" required />
              </label>
              <button type="submit" disabled={submitting}>
                Add site
              </button>
            </Form>
          </div>
        ))}
      </section>

      <section>
        <h2>Create a workspace</h2>
        {/* Nested index routes need the `?index` marker so the form
            posts to this route's action rather than the parent layout's
            (which has none) — a known React Router quirk. */}
        <Form method="post" action="?index">
          <input type="hidden" name="intent" value="create-workspace" />
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required />
          <button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create workspace"}
          </button>
        </Form>
      </section>

      {actionData && "error" in actionData ? <p role="alert">{actionData.error}</p> : null}
      {actionData && "success" in actionData ? <p>Done.</p> : null}
    </main>
  );
}
