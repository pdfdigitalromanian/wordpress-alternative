import { resolveStorefront } from "~/lib/commerce.server";
import { listStoreProducts } from "~/lib/medusa.server";
import type { Route } from "./+types/api.storefront-products";

/**
 * The ONE fetch path the ProductGrid Puck component uses to get real
 * product data, in both the editor (client-side, live preview via
 * Puck's resolveData) and the published site (server-side, via
 * resolveAllData before <Render>). Puck's resolveData must be isomorphic
 * — it runs in the browser during editing — so component-registry/
 * config.tsx cannot import medusa.server.ts (node:dns, undici) directly;
 * this route is the boundary instead. Publishable-key-scoped only, same
 * trust level as the public storefront itself.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const siteId = url.searchParams.get("siteId");
  const limit = Number(url.searchParams.get("limit") ?? "8");
  const categoryId = url.searchParams.get("categoryId") || undefined;

  if (!siteId) return Response.json({ error: "Missing siteId" }, { status: 400 });

  const storefront = await resolveStorefront(siteId);
  if (!storefront.ready) {
    return Response.json({ error: storefront.message, products: [], currencyCode: null });
  }

  try {
    const { products } = await listStoreProducts(storefront.backendUrl, storefront.publishableKey, {
      regionId: storefront.region.id,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 24) : 8,
      categoryId,
    });

    const summaries = products.map((product) => {
      const cheapestVariant = product.variants
        .filter((v) => v.calculated_price?.calculated_amount != null)
        .sort((a, b) => (a.calculated_price!.calculated_amount! - b.calculated_price!.calculated_amount!))[0];
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        thumbnail: product.thumbnail,
        price: cheapestVariant?.calculated_price?.calculated_amount ?? null,
      };
    });

    return Response.json({ products: summaries, currencyCode: storefront.region.currency_code, error: null });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Could not load products.",
      products: [],
      currencyCode: storefront.region.currency_code,
    });
  }
}
