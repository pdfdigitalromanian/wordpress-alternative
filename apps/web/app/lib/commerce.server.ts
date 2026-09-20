import { createCookie } from "react-router";
import { createSupabaseAdminClient } from "~/lib/supabase.server";
import {
  addStoreCartLineItem,
  createStoreCart,
  getStoreCart,
  listStoreRegions,
  removeStoreCartLineItem,
  updateStoreCartLineItem,
  type CartMutationResult,
  type StoreCart,
  type StoreRegion,
} from "~/lib/medusa.server";

/**
 * The server-side storefront adapter (work order SS4): the one place
 * that resolves "does this site have a working, checkout-capable
 * commerce connection" and hands back what the public routes and the
 * ProductGrid Puck component need — publishable key, backend URL, and a
 * region — without ever touching the site's Admin secret key. Storefront
 * code never sees that key; only apps/web/app/routes/admin/store*.tsx
 * (staff-authenticated) does.
 */

export type StorefrontReady = {
  ready: true;
  siteId: string;
  backendUrl: string;
  publishableKey: string;
  region: StoreRegion;
};

export type StorefrontNotReady = {
  ready: false;
  siteId: string;
  reason: "no_connection" | "no_publishable_key" | "connection_not_tested" | "no_region";
  message: string;
};

export type Storefront = StorefrontReady | StorefrontNotReady;

/**
 * Deliberately distinguishes three separate readiness states, per the
 * work order: "Admin API reachable" (checked once, at Store-setup time,
 * not here) is not the same claim as "storefront configured" (this
 * function) which is not the same claim as "checkout ready" (would also
 * need shipping/payment configuration — not implemented yet, so a
 * region existing is the furthest this goes for now).
 */
export async function resolveStorefront(siteId: string): Promise<Storefront> {
  const admin = createSupabaseAdminClient();

  const { data: connection, error } = await admin
    .from("commerce_connections")
    .select("backend_url, publishable_key, status")
    .eq("site_id", siteId)
    .maybeSingle();

  if (error || !connection) {
    return { ready: false, siteId, reason: "no_connection", message: "This site has no commerce connection configured." };
  }
  if (!connection.publishable_key) {
    return {
      ready: false,
      siteId,
      reason: "no_publishable_key",
      message: "This site's commerce connection has no publishable key set (Store → add one).",
    };
  }
  if (connection.status !== "connected") {
    return {
      ready: false,
      siteId,
      reason: "connection_not_tested",
      message: "This site's commerce connection hasn't been verified yet (Store → Test connection).",
    };
  }

  let regions: StoreRegion[];
  try {
    regions = await listStoreRegions(connection.backend_url, connection.publishable_key);
  } catch {
    return {
      ready: false,
      siteId,
      reason: "no_region",
      message: "Could not read regions from the connected Medusa backend.",
    };
  }
  if (regions.length === 0) {
    return { ready: false, siteId, reason: "no_region", message: "The connected Medusa backend has no regions configured." };
  }

  // Region/currency/country selection is not yet configurable per site
  // (Part B SS22) — the first region is used, which is correct for a
  // single-region store (the only case this has been verified against)
  // and a documented, visible simplification otherwise, not a silent
  // guess: multi-region stores will show every product in that one
  // region's currency until this is built out.
  return {
    ready: true,
    siteId,
    backendUrl: connection.backend_url,
    publishableKey: connection.publishable_key,
    region: regions[0],
  };
}

// ---------------------------------------------------------------------
// Cart cookie — a real Medusa cart, not a browser-storage cart. The
// cookie only ever holds the cart's opaque Medusa ID; Medusa remains the
// source of truth for items, quantities and totals.
// ---------------------------------------------------------------------

function cartCookie(siteId: string) {
  return createCookie(`drcms_cart_${siteId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secrets: process.env.SESSION_SECRET ? [process.env.SESSION_SECRET] : undefined,
  });
}

async function getCartIdFromRequest(request: Request, siteId: string): Promise<string | null> {
  const value = await cartCookie(siteId).parse(request.headers.get("Cookie"));
  return typeof value === "string" ? value : null;
}

/**
 * Resolves the visitor's cart for this site, creating one if none exists
 * or the stored one is gone/expired/for a different region (e.g. the
 * connection was reconfigured) — never treats an invalid cart ID as an
 * error the visitor sees; a fresh cart is created instead, honestly.
 * Returns a Set-Cookie header to attach to the response when the cart
 * identity changed.
 */
export async function resolveCart(
  request: Request,
  storefront: StorefrontReady,
): Promise<{ cart: StoreCart; setCookieHeader?: string }> {
  const existingId = await getCartIdFromRequest(request, storefront.siteId);

  if (existingId) {
    const existing = await getStoreCart(storefront.backendUrl, storefront.publishableKey, existingId).catch(() => null);
    if (existing && existing.region_id === storefront.region.id) {
      return { cart: existing };
    }
  }

  const cart = await createStoreCart(storefront.backendUrl, storefront.publishableKey, storefront.region.id);
  const setCookieHeader = await cartCookie(storefront.siteId).serialize(cart.id);
  return { cart, setCookieHeader };
}

export async function clearCartCookieHeader(siteId: string): Promise<string> {
  return cartCookie(siteId).serialize("", { maxAge: 0 });
}

export type { CartMutationResult };
export { addStoreCartLineItem, updateStoreCartLineItem, removeStoreCartLineItem };
