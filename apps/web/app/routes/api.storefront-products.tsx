import { resolveStorefront, buildProductSummaries } from "~/lib/commerce.server";
import { listStoreProducts } from "~/lib/medusa.server";
import { resolveSiteIdByHost } from "~/lib/site-resolution.server";
import type { Route } from "./+types/api.storefront-products";

/**
 * PUBLIC path only. The site is resolved strictly from the verified
 * host mapping (Part A SS13) — an anonymous caller cannot select
 * another site's stored backend/products by passing an arbitrary
 * `?siteId=`. A query-string `siteId` is accepted only as a same-site
 * confirmation (matching what the host itself resolves to); a mismatch
 * is treated the same as "not found", not disclosed as "wrong site".
 *
 * Authenticated staff previewing a site that has no public domain yet
 * (so this path can't resolve it) use the separate
 * api.preview-storefront-products.tsx instead — see
 * component-registry/config.tsx's ProductGrid.resolveData, which picks
 * the endpoint based on `metadata.mode`.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const requestedSiteId = url.searchParams.get("siteId");
  const limit = Number(url.searchParams.get("limit") ?? "8");
  const categoryId = url.searchParams.get("categoryId") || undefined;

  const resolvedSiteId = await resolveSiteIdByHost(request);
  if (!resolvedSiteId) {
    return Response.json({ error: "Unknown site.", products: [], currencyCode: null }, { status: 404 });
  }
  if (requestedSiteId && requestedSiteId !== resolvedSiteId) {
    // Never confirm or deny another site's existence/config to an
    // anonymous caller — same response as "unknown site".
    return Response.json({ error: "Unknown site.", products: [], currencyCode: null }, { status: 404 });
  }

  const storefront = await resolveStorefront(resolvedSiteId);
  if (!storefront.ready) {
    return Response.json({ error: storefront.message, products: [], currencyCode: null });
  }

  try {
    const { products } = await listStoreProducts(storefront.backendUrl, storefront.publishableKey, {
      regionId: storefront.region.id,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 24) : 8,
      categoryId,
    });

    return Response.json({
      products: buildProductSummaries(products),
      currencyCode: storefront.region.currency_code,
      error: null,
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Could not load products.",
      products: [],
      currencyCode: storefront.region.currency_code,
    });
  }
}
