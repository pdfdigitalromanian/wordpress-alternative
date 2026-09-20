import { createSupabaseAdminClient } from "~/lib/supabase.server";

/**
 * Shared by every public route (site-page, shop, product detail, cart):
 * resolves the requesting Host strictly through a registered, verified
 * domain mapping. Never trust an arbitrary Host header as a site
 * identifier, and never fall back to "the first site" for an
 * unrecognized host (Part A SS13).
 */
export async function resolveSiteIdByHost(request: Request): Promise<string | null> {
  const hostname = new URL(request.url).hostname;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("public_site_by_hostname")
    .select("site_id")
    .eq("hostname", hostname)
    .maybeSingle();

  if (error || !data?.site_id) return null;
  return data.site_id;
}
