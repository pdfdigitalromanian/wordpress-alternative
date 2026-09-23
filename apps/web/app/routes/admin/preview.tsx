import { Link, useLoaderData, data } from "react-router";
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { siteAccess } from "~/lib/site-access.server";
import { componentConfig, type ComponentProps } from "~/lib/component-registry/config";
import { resolveStorefront, buildProductSummaries } from "~/lib/commerce.server";
import { listStoreProducts } from "~/lib/medusa.server";
import type { Route } from "./+types/preview";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, site, canEdit } = await siteAccess(request, params.siteId);
  const releaseId = new URL(request.url).searchParams.get("release");
  let document: unknown;
  let title: string;
  if (releaseId) {
    const { data: release } = await supabase.from("releases").select("id").eq("id", releaseId).eq("site_id", site.id).maybeSingle();
    if (!release) throw new Response("Release not found", { status: 404 });
    const { data: page } = await supabase.from("release_pages").select("title,document").eq("id", params.previewId).eq("release_id", release.id).maybeSingle();
    if (!page) throw new Response("Page not found", { status: 404 });
    document = page.document; title = page.title;
  } else {
    const { data: page } = await supabase.from("pages").select("title,draft_document").eq("id", params.previewId).eq("site_id", site.id).maybeSingle();
    if (!page) throw new Response("Page not found", { status: 404 });
    document = page.draft_document; title = page.title;
  }
  // Fetch commerce directly on the server after staff authorization. Never
  // forward a staff cookie to an origin constructed from the request host.
  const storefront = resolveStorefront(site.id);
  const resolveProducts = async (limit: number, productId?: string, categoryId?: string) => {
    const store = await storefront;
    if (!store.ready) return { resolvedProducts: [], resolvedError: store.message, resolvedCurrency: null };
    try {
      const result = await listStoreProducts(store.backendUrl, store.publishableKey, { regionId: store.region.id, limit, productId, categoryId });
      return { resolvedProducts: buildProductSummaries(result.products), resolvedCurrency: store.region.currency_code, resolvedError: null };
    } catch { return { resolvedProducts: [], resolvedError: "Store products are temporarily unavailable.", resolvedCurrency: null }; }
  };
  const previewConfig = { ...componentConfig, components: { ...componentConfig.components,
    ProductGrid: { ...componentConfig.components.ProductGrid, resolveData: async ({ props }: { props: ComponentProps["ProductGrid"] & { id: string } }) => ({ props: { ...props, ...await resolveProducts(props.limit || 8, undefined, props.categoryId) } }) },
    ProductCard: { ...componentConfig.components.ProductCard, resolveData: async ({ props }: { props: ComponentProps["ProductCard"] & { id: string } }) => ({ props: { ...props, ...(props.product?.id ? await resolveProducts(1, props.product.id) : { resolvedProducts: [], resolvedError: null }) } }) },
  } };
  const resolved = await resolveAllData<ComponentProps>(document as Data<ComponentProps>, previewConfig);
  return data({ site, canEdit, title, document: resolved, releaseId, previewId: params.previewId }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
export function headers() { return { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" }; }
export function meta() { return [{ title: "Private website preview" }, { name: "robots", content: "noindex, nofollow" }]; }
export default function Preview() {
  const { site, title, document, releaseId, canEdit, previewId } = useLoaderData<typeof loader>();
  return <div className="private-preview"><header className="preview-toolbar"><div><span className="badge badge-amber">Private {releaseId ? "release" : "draft"} preview</span><strong>{title}</strong></div><div><span className="muted">{site.name}</span><Link className="btn-secondary" to={`/admin/sites/${site.id}/${releaseId ? "publishing" : "pages"}`}>Back to {releaseId ? "releases" : "pages"}</Link>{canEdit && !releaseId ? <Link className="btn" to={`/admin/sites/${site.id}/pages/${previewId}`}>Back to editor</Link> : null}</div></header><p className="preview-notice">Only signed-in workspace members can see this preview. Page links and shopping actions are disabled here.</p><div onClickCapture={event => { if ((event.target as Element).closest("a")) event.preventDefault(); }}><Render config={componentConfig} data={document} /></div></div>;
}
