import { Form, Outlet, redirect, useLoaderData } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw redirect("/login");

  return { email: user.email };
}

// This is the CMS admin shell — visually distinct from the public site
// theme (Part A SS2). Only the Overview area exists so far; the other
// admin areas (Pages, Posts, Collections, ...) arrive with the
// milestones that give them real data.
export default function AdminLayout() {
  const { email } = useLoaderData<typeof loader>();

  return (
    <div>
      <header>
        <strong>Digital Romanian CMS — Admin</strong>
        <span> {email}</span>
        <Form method="post" action="/logout" style={{ display: "inline" }}>
          <button type="submit">Sign out</button>
        </Form>
      </header>
      <Outlet />
    </div>
  );
}
