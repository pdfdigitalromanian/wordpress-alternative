import { createSupabaseAdminClient } from "~/lib/supabase.server";
import type { Route } from "./+types/home";

export async function loader({ request }: Route.LoaderArgs) {
  // Resolve the site strictly through a registered, verified domain
  // mapping — never trust an arbitrary Host header as a site identifier,
  // and never fall back to "the first site" for an unrecognized host
  // (Part A SS13). `request.url`'s host reflects the Host header the
  // server actually received the request on.
  const hostname = new URL(request.url).hostname;

  const admin = createSupabaseAdminClient();
  const { data: mapping, error } = await admin
    .from("public_site_by_hostname")
    .select("site_id")
    .eq("hostname", hostname)
    .maybeSingle();

  if (error) throw new Response("Internal Server Error", { status: 500 });
  if (!mapping?.site_id) throw new Response("Not Found", { status: 404 });

  const { data: site, error: siteError } = await admin
    .from("sites")
    .select("name")
    .eq("id", mapping.site_id)
    .single();

  if (siteError || !site) throw new Response("Not Found", { status: 404 });

  return { siteName: site.name, hostname };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Digital Romanian CMS" }];
  return [{ title: loaderData.siteName }];
}

export default function PublicSiteHome({ loaderData }: Route.ComponentProps) {
  // Real page/block rendering (Puck documents, releases) arrives in M2.
  // This confirms the resolution mechanism itself: an unknown host never
  // reaches this point (404 above), and a verified one renders real,
  // server-side content identifying the actual resolved site — not a
  // static placeholder shared by every host.
  return (
    <main>
      <h1>{loaderData.siteName}</h1>
      <p>Resolved from verified domain: {loaderData.hostname}</p>
      <p>Page content and the visual editor arrive in a later milestone.</p>
    </main>
  );
}
