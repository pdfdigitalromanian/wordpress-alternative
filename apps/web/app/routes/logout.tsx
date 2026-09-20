import { redirect } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  await supabase.auth.signOut();
  throw redirect("/login", { headers });
}

// GET /logout also signs out — convenient for a plain link, and signing
// out has no destructive side effect worth guarding behind a form post.
export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  await supabase.auth.signOut();
  throw redirect("/login", { headers });
}
