import { createHash } from "node:crypto";
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
  type StoreProduct,
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
 * function) which is not the same claim as "checkout ready" (also needs
 * a payment provider — see resolveCheckoutReadiness below).
 */
export async function resolveStorefront(siteId: string): Promise<Storefront> {
  const admin = createSupabaseAdminClient();

  const { data: connection, error } = await admin
    .from("commerce_connections")
    .select("backend_url, publishable_key, status, default_region_id")
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

  // An explicit per-site default region (Store → set one) takes
  // precedence; falling back to the first region only when none is
  // configured, so a single-region store keeps working with zero setup
  // (work order SS3C: "a simple single-region implementation is
  // sufficient for this milestone").
  const region =
    (connection.default_region_id ? regions.find((r) => r.id === connection.default_region_id) : undefined) ?? regions[0];

  return {
    ready: true,
    siteId,
    backendUrl: connection.backend_url,
    publishableKey: connection.publishable_key,
    region,
  };
}

/**
 * Shared by the public and staff-preview product endpoints so both
 * return the exact same (small, non-privileged) product shape.
 */
export function buildProductSummaries(products: StoreProduct[]) {
  return products.map((product) => {
    const cheapestVariant = product.variants
      .filter((v) => v.calculated_price?.calculated_amount != null)
      .sort((a, b) => a.calculated_price!.calculated_amount! - b.calculated_price!.calculated_amount!)[0];
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      thumbnail: product.thumbnail,
      price: cheapestVariant?.calculated_price?.calculated_amount ?? null,
    };
  });
}

// ---------------------------------------------------------------------
// Signing secret — required, not optional. A cart/checkout/order-access
// cookie is a real access-control boundary (see below); issuing one
// unsigned would let a client forge a cart ID or, worse, an order-access
// claim outright.
// ---------------------------------------------------------------------

let cachedSecret: string | null = null;

function requireSessionSecret(): string {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.SESSION_SECRET;
  const looksLikePlaceholder = !secret || secret.length < 16 || /^(changeme|secret|placeholder|test|example|xxx)/i.test(secret);
  if (looksLikePlaceholder) {
    throw new Error(
      "SESSION_SECRET is missing or looks like a placeholder value. Cart and checkout cookies must be signed with a " +
        "real secret — refusing to issue an unsigned cookie. Generate one locally with: openssl rand -base64 32",
    );
  }
  cachedSecret = secret;
  return secret;
}

function connectionFingerprint(backendUrl: string, publishableKey: string): string {
  return createHash("sha256").update(`${backendUrl}\u0000${publishableKey}`).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------
// Cart cookie — a real Medusa cart, not a browser-storage cart. The
// signed payload binds the cart ID to the site, the connection identity
// (backend+key) and the region it was created for — not just a cart ID
// under a site-scoped cookie *name*, since all cookies share the same
// signing key and a name alone isn't cryptographic context binding.
// Retrieval re-validates every one of these fields against the site's
// CURRENT resolved storefront before trusting the cart ID.
// ---------------------------------------------------------------------

type CartSession = {
  cartId: string;
  siteId: string;
  connectionFingerprint: string;
  regionId: string;
};

function cartCookie(siteId: string) {
  return createCookie(`drcms_cart_${siteId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secrets: [requireSessionSecret()],
  });
}

async function getCartSession(request: Request, siteId: string): Promise<CartSession | null> {
  const value = await cartCookie(siteId).parse(request.headers.get("Cookie"));
  if (!isPlainRecord(value)) return null;
  if (
    typeof value.cartId !== "string" ||
    typeof value.siteId !== "string" ||
    typeof value.connectionFingerprint !== "string" ||
    typeof value.regionId !== "string"
  ) {
    return null;
  }
  return value as CartSession;
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Looks up the visitor's existing cart WITHOUT creating one — used by
 * read-only views (the /cart page, /checkout's initial load) so a bot or
 * an idle visitor doesn't spawn a cart in Medusa just by loading a page.
 * Three outcomes, not two: a usable cart, no cart yet (not an error), or
 * a genuine upstream problem (also not "no cart" — the caller must not
 * treat a timeout the same as "nothing here yet").
 */
export type PeekCartResult =
  | { status: "found"; cart: StoreCart }
  | { status: "none" }
  | { status: "unavailable"; message: string };

export async function peekCart(request: Request, storefront: StorefrontReady): Promise<PeekCartResult> {
  const session = await getCartSession(request, storefront.siteId);
  if (!session) return { status: "none" };

  const fingerprint = connectionFingerprint(storefront.backendUrl, storefront.publishableKey);
  if (session.siteId !== storefront.siteId || session.connectionFingerprint !== fingerprint || session.regionId !== storefront.region.id) {
    // The stored session doesn't match this site's CURRENT commerce
    // context (e.g. the connection was reconfigured) — treat as no cart,
    // not as the wrong cart.
    return { status: "none" };
  }

  let cart: StoreCart | null;
  try {
    cart = await getStoreCart(storefront.backendUrl, storefront.publishableKey, session.cartId);
  } catch (error) {
    // A transient failure is NOT "no cart" — preserve the cookie
    // (the caller does nothing, since we return before any Set-Cookie is
    // produced) and tell the caller to show a retryable message rather
    // than silently discarding the visitor's cart identity.
    return { status: "unavailable", message: error instanceof Error ? error.message : "Could not reach the store." };
  }

  if (!cart || cart.completed_at) return { status: "none" };
  return { status: "found", cart };
}

/**
 * Gets-or-creates the visitor's cart — used by mutation actions
 * (add/update/remove line item, checkout steps) where "no cart yet" is
 * resolved by creating one, not by erroring. A transient upstream
 * failure while looking up an EXISTING cart is surfaced distinctly
 * (`unavailable`) instead of silently creating a replacement and losing
 * the visitor's cart identity.
 */
export type ResolveCartResult =
  | { status: "ok"; cart: StoreCart; setCookieHeader?: string }
  | { status: "unavailable"; message: string };

export async function resolveCart(request: Request, storefront: StorefrontReady): Promise<ResolveCartResult> {
  const peek = await peekCart(request, storefront);
  if (peek.status === "found") return { status: "ok", cart: peek.cart };
  if (peek.status === "unavailable") return { status: "unavailable", message: peek.message };

  // status === "none": genuinely nothing usable — create fresh.
  let cart: StoreCart;
  try {
    cart = await createStoreCart(storefront.backendUrl, storefront.publishableKey, storefront.region.id);
  } catch (error) {
    return { status: "unavailable", message: error instanceof Error ? error.message : "Could not reach the store." };
  }

  const session: CartSession = {
    cartId: cart.id,
    siteId: storefront.siteId,
    connectionFingerprint: connectionFingerprint(storefront.backendUrl, storefront.publishableKey),
    regionId: storefront.region.id,
  };
  const setCookieHeader = await cartCookie(storefront.siteId).serialize(session);
  return { status: "ok", cart, setCookieHeader };
}

export async function clearCartCookieHeader(siteId: string): Promise<string> {
  return cartCookie(siteId).serialize("", { maxAge: 0 });
}

/** Integer quantity in [1, 99] — anything else is rejected, not coerced. */
export function parseValidQuantity(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 99) return null;
  return n;
}

/** True only if `lineItemId` actually belongs to `cart` — reject path/ID manipulation before it ever reaches Medusa. */
export function cartHasLineItem(cart: StoreCart, lineItemId: string): boolean {
  return cart.items.some((item) => item.id === lineItemId);
}

// ---------------------------------------------------------------------
// Order access — a completed order's confirmation page must not be
// readable from the order ID alone (Medusa's own /store/orders/:id
// requires only the publishable key, which is not order-specific —
// verified directly: it returned full order detail for any order ID
// with no other credential). This signed, short-lived, site-scoped
// cookie is the actual access boundary; checkout-confirmation.tsx never
// reads an order ID from the URL at all.
// ---------------------------------------------------------------------

type OrderAccessSession = { orderId: string; siteId: string };

function orderAccessCookie(siteId: string) {
  return createCookie(`drcms_order_${siteId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h receipt access, not indefinite
    secrets: [requireSessionSecret()],
  });
}

export async function grantOrderAccessHeader(siteId: string, orderId: string): Promise<string> {
  const session: OrderAccessSession = { orderId, siteId };
  return orderAccessCookie(siteId).serialize(session);
}

export async function getAuthorizedOrderId(request: Request, siteId: string): Promise<string | null> {
  const value = await orderAccessCookie(siteId).parse(request.headers.get("Cookie"));
  if (!isPlainRecord(value) || typeof value.orderId !== "string" || value.siteId !== siteId) return null;
  return value.orderId;
}

export type { CartMutationResult };
export { addStoreCartLineItem, updateStoreCartLineItem, removeStoreCartLineItem };
