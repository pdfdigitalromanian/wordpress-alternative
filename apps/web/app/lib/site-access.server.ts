import { redirect } from "react-router";
import { createSupabaseServerClient } from "./supabase.server";

export async function siteAccess(request: Request, siteId: string) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw redirect(`/login?returnTo=${encodeURIComponent(new URL(request.url).pathname)}`, { headers });
  const { data: site } = await supabase.from("sites").select("id, name, slug, workspace_id, active_release_id").eq("id", siteId).maybeSingle();
  if (!site) throw new Response("Site not found", { status: 404 });
  const { data: role } = await supabase.rpc("workspace_role_of", { target_workspace_id: site.workspace_id });
  const canEdit = role === "owner" || role === "administrator" || role === "editor";
  const canManage = role === "owner" || role === "administrator";
  return { supabase, headers, user, site, role, canEdit, canManage };
}
