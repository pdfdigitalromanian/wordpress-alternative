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
    <div className="admin-shell">
      <header className="admin-header">
        <strong className="text-lg font-semibold">Digital Romanian CMS — Admin</strong>
        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
          <span>{email}</span>
          <Form method="post" action="/logout">
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </Form>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
