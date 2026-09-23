import { createSupabaseServerClient } from "~/lib/supabase.server";
import { resolveStorefront, buildProductSummaries } from "~/lib/commerce.server";
import { listStoreProducts } from "~/lib/medusa.server";
import type { Route } from "./+types/api.preview-storefront-products";

/**
 * STAFF-ONLY path, for the editor's live preview (page-editor.tsx),
 * where the site being edited may not have a public domain yet — the
 * public api.storefront-products.tsx can't resolve it from Host in that
 * case, and must not accept an arbitrary `?siteId=` from an anonymous
 * caller either way. Here, `siteId` IS accepted explicitly, but only
 * after: (1) a real Supabase staff session (same-origin browser fetch
 * from the editor carries the session cookie automatically), and (2)
 * RLS-backed workspace-membership confirmation via a normal
 * user-scoped `sites` select — no separate permission check to
 * hand-roll or get wrong; it's the same rule every other authenticated
 * site read in this app already uses.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const siteId = url.searchParams.get("siteId");
  const limit = Number(url.searchParams.get("limit") ?? "8");
  const categoryId = url.searchParams.get("categoryId") || undefined;

  if (!siteId) return Response.json({ error: "Missing siteId" }, { status: 400 });

  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // RLS on `sites` already restricts this to workspace members; a
  // non-member's or nonexistent site's ID returns no row.
  const { data: site, error: siteError } = await supabase.from("sites").select("id").eq("id", siteId).maybeSingle();
  if (siteError || !site) return Response.json({ error: "Not found" }, { status: 404 });

  const storefront = await resolveStorefront(siteId);
  if (!storefront.ready) {
    return Response.json({ error: storefront.message, products: [], currencyCode: null });
  }

  try {
    const { products } = await listStoreProducts(storefront.backendUrl, storefront.publishableKey, {
      regionId: storefront.region.id,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 24) : 8,
      categoryId,
      q: url.searchParams.get("q")?.slice(0, 200) || undefined,
      productId: url.searchParams.get("productId") || undefined,
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
