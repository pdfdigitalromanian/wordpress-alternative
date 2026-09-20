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
  // RLS (workspaces_select) already restricts this to workspaces the
  // signed-in user is a member of — no explicit filter needed or trusted
  // from the client.
  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("id, name, slug, created_at")
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
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Workspace name is required." };

  const slug = slugify(name);
  if (!slug) return { error: "Could not derive a valid slug from that name." };

  const { error } = await supabase.from("workspaces").insert({ name, slug, created_by: user.id });

  if (error) {
    if (error.code === "23505") return { error: "A workspace with that slug already exists." };
    return { error: error.message };
  }

  return { success: true };
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
        {workspaces.length === 0 ? (
          <p>No workspaces yet. Create one below to add your first site.</p>
        ) : (
          <ul>
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                {workspace.name} <code>({workspace.slug})</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Create a workspace</h2>
        {/* Nested index routes need the `?index` marker so the form
            posts to this route's action rather than the parent layout's
            (which has none) — a known React Router quirk. */}
        <Form method="post" action="?index">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required />
          <button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create workspace"}
          </button>
        </Form>
        {actionData && "error" in actionData ? <p role="alert">{actionData.error}</p> : null}
        {actionData && "success" in actionData ? <p>Workspace created.</p> : null}
      </section>
    </main>
  );
}
