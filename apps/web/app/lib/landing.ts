import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./supabase.server";

// Screen order from digital-romanian-screens.html:
//   /signup -> /signup/password -> /signup/created
//   -> /onboarding/profile -> /onboarding/workspace -> /workspace
//
// So signing in or signing up never lands straight in /admin: a user without a
// profile is sent to set one up, a user without a workspace is sent to create
// one, and only a user who has both reaches the workspace screen.

export const ONBOARDING_PROFILE = "/onboarding/profile";
export const ONBOARDING_WORKSPACE = "/onboarding/workspace";
export const WORKSPACE_HOME = "/workspace";

function hasProfile(user: User) {
  return Boolean(user.user_metadata?.display_name);
}

export async function hasWorkspace(request: Request, user: User) {
  const { supabase } = createSupabaseServerClient(request);
  const { data, error } = await supabase
    .from("workspace_memberships")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    // RLS or a transient failure must not strand the user on a dead end:
    // fall through to the workspace onboarding screen, which reports the error.
    return false;
  }

  return Boolean(data);
}

export async function landingFor(request: Request, user: User) {
  if (!hasProfile(user)) return ONBOARDING_PROFILE;
  if (!(await hasWorkspace(request, user))) return ONBOARDING_WORKSPACE;
  return WORKSPACE_HOME;
}
