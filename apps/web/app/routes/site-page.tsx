// The dedicated "rsc" entry excludes the drag-and-drop editor chrome
// (dnd-kit, ActionBar, Drawer, ...) entirely — importing Render from the
// main "@puckeditor/core" specifier instead pulled the full ~455KB editor
// bundle into this public route, since it shares a chunk with the editor
// import in page-editor.tsx. Verified via the built output that this
// keeps the two apart (Part A SS5: "Keep editor-specific code and
// controls out of public website bundles").
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { componentConfig, type ComponentProps, type StorefrontMetadata } from "~/lib/component-registry/config";
import { createSupabaseAdminClient } from "~/lib/supabase.server";
import type { Route } from "./+types/site-page";

export async function loader({ request }: Route.LoaderArgs) {
  // Resolve strictly through a registered, verified domain mapping —
  // never trust an arbitrary Host header as a site identifier (Part A
  // SS13). `request.url`'s hostname reflects the Host header the server
  // actually received the request on.
  const url = new URL(request.url);
  const hostname = url.hostname;
  const slug = url.pathname.replace(/^\/+|\/+$/g, ""); // "" for "/", "about" for "/about"

  const admin = createSupabaseAdminClient();

  const { data: mapping, error: mappingError } = await admin
    .from("public_site_by_hostname")
    .select("site_id")
    .eq("hostname", hostname)
    .maybeSingle();

  if (mappingError) throw new Response("Internal Server Error", { status: 500 });
  if (!mapping?.site_id) throw new Response("Not Found", { status: 404 });

  const { data: site, error: siteError } = await admin
    .from("sites")
    .select("active_release_id")
    .eq("id", mapping.site_id)
    .single();

  // No active release yet — publishing is a deliberate, separate action
  // from having a site at all (Part A SS10). Draft content never renders
  // here, published or not.
  if (siteError || !site?.active_release_id) throw new Response("Not Found", { status: 404 });

  const { data: releasePage, error: pageError } = await admin
    .from("release_pages")
    .select("title, document")
    .eq("release_id", site.active_release_id)
    .eq("slug", slug)
    .maybeSingle();

  if (pageError) throw new Response("Internal Server Error", { status: 500 });
  if (!releasePage) throw new Response("Not Found", { status: 404 });

  // Resolves any dynamic component data (e.g. ProductGrid's real product
  // list) server-side, before the response is ever sent — so it's in the
  // INITIAL HTML, not fetched client-side after hydration.
  const metadata: StorefrontMetadata = { siteId: mapping.site_id, origin: url.origin };
  const resolvedDocument = await resolveAllData<ComponentProps>(
    releasePage.document as Partial<Data<ComponentProps>>,
    componentConfig,
    metadata,
  );

  return { title: releasePage.title, document: resolvedDocument };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Digital Romanian CMS" }];
  return [{ title: loaderData.title }];
}

export default function SitePage({ loaderData }: Route.ComponentProps) {
  return <Render config={componentConfig} data={loaderData.document} />;
}
