import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { z } from "zod";

/**
 * Server boundary between CMS code and a site's Medusa installation
 * (Part B SS20). Two credential tiers, never mixed:
 *  - Admin API (secret key, HTTP Basic auth) — Store admin area only,
 *    staff-authenticated, server-only.
 *  - Store API (publishable key, `x-publishable-api-key` header) — the
 *    public storefront's only path to Medusa. Never uses the secret key.
 * Both verified directly against a running local Medusa v2 instance,
 * including exact auth header shape and cart/product response fields.
 *
 * ---------------------------------------------------------------------
 * SSRF guard
 * ---------------------------------------------------------------------
 * The backend URL is operator/owner input (typed into the Store setup
 * form), not a hardcoded value, so every outbound request goes through
 * `resolveSafeTarget`:
 *  - An explicit allowlist (`COMMERCE_ALLOWED_BACKEND_ORIGINS`, exact
 *    "scheme://host:port" entries) is checked first and always wins —
 *    this is the preferred, operator-approved mechanism.
 *  - Outside the allowlist, a bare localhost/127.0.0.1/::1 exception
 *    exists ONLY when `NODE_ENV !== "production"` — disabled in
 *    production, not just "usually fine".
 *  - Anything else must be https, must not embed URL credentials
 *    (`user:pass@host`), and must not resolve to a private/loopback/
 *    link-local address.
 *  - DNS is resolved exactly once, validated, and the connection is
 *    PINNED to that resolved IP via an undici Agent with a custom
 *    `connect.lookup` — closing the classic DNS-rebinding gap where a
 *    hostname resolves safely at check time and differently at connect
 *    time (verified: fetch()'s own resolution is a separate step from
 *    any pre-check unless pinned like this).
 *  - Redirects are never followed (`redirect: "manual"`) — a validated
 *    safe URL redirecting to an internal one is a known SSRF bypass.
 */

const PRIVATE_IPV4_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const target = ipv4ToInt(ip);
  return PRIVATE_IPV4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (target & mask) === (ipv4ToInt(base) & mask);
  });
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd");
}

function getAllowlistedOrigins(): Set<string> {
  const raw = process.env.COMMERCE_ALLOWED_BACKEND_ORIGINS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

type SafeTarget = { url: URL; pinnedIp: string | null };

async function resolveSafeTarget(rawUrl: string): Promise<SafeTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Backend URL is not a valid URL.");
  }

  if (url.username || url.password) {
    throw new Error("Backend URL must not contain embedded credentials.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Backend URL must use http or https.");
  }

  const origin = `${url.protocol}//${url.host}`;
  const isAllowlisted = getAllowlistedOrigins().has(origin);

  // Computed ONCE from the literal hostname string and reused for both
  // checks below. A private-IP-in-dev check re-derived independently
  // (rather than reusing this) would wrongly admit ANY RFC1918 address
  // in development, not just localhost — that was a real bug here,
  // caught by medusa.server.test.ts, not a hypothetical.
  const isDevLocalhostHostname =
    process.env.NODE_ENV !== "production" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1");

  if (!isAllowlisted && !isDevLocalhostHostname && url.protocol !== "https:") {
    throw new Error("Non-allowlisted backend URLs must use https.");
  }

  const ipVersion = isIP(url.hostname);
  let pinnedIp: string;

  if (ipVersion !== 0) {
    pinnedIp = url.hostname;
  } else {
    const addresses = await lookup(url.hostname, { all: true }).catch(() => {
      throw new Error("Could not resolve backend hostname.");
    });
    if (addresses.length === 0) throw new Error("Backend hostname did not resolve to any address.");
    pinnedIp = addresses[0].address;
  }

  if (!isAllowlisted && !isDevLocalhostHostname) {
    const family = isIP(pinnedIp);
    const isPrivate = family === 4 ? isPrivateIPv4(pinnedIp) : isPrivateIPv6(pinnedIp);
    if (isPrivate) {
      throw new Error("Backend URL resolves to a private, loopback, or link-local address.");
    }
  }

  return { url, pinnedIp };
}

function pinnedAgent(pinnedIp: string): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname, _options, callback) => {
        callback(null, [{ address: pinnedIp, family: isIP(pinnedIp) as 4 | 6 }]);
      },
    },
  });
}

class MedusaRequestError extends Error {
  reason: "unreachable" | "unauthorized" | "unsupported" | "invalid_response" | "unknown";
  constructor(reason: MedusaRequestError["reason"], message: string) {
    super(message);
    this.reason = reason;
  }
}

type FetchOptions = {
  backendUrl: string;
  path: string;
  searchParams?: Record<string, string>;
  authHeader: string;
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
};

async function fetchMedusaJson<T>(opts: FetchOptions, schema: z.ZodType<T>): Promise<T> {
  const { url: base, pinnedIp } = await resolveSafeTarget(opts.backendUrl);
  const url = new URL(opts.path, base);
  for (const [key, value] of Object.entries(opts.searchParams ?? {})) {
    url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = (await undiciFetch(url, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: opts.authHeader.startsWith("Basic") ? opts.authHeader : undefined,
        "x-publishable-api-key": opts.authHeader.startsWith("Basic") ? undefined : opts.authHeader,
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      } as Record<string, string>,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      redirect: "manual",
      signal: controller.signal,
      dispatcher: pinnedIp ? pinnedAgent(pinnedIp) : undefined,
    })) as unknown as Response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new MedusaRequestError("unreachable", "Medusa backend did not respond in time.");
    }
    throw new MedusaRequestError("unreachable", "Could not reach the Medusa backend (network error).");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status >= 300 && response.status < 400) {
    throw new MedusaRequestError("unsupported", "Medusa backend returned an unexpected redirect.");
  }
  if (response.status === 401 || response.status === 400) {
    // Medusa returns 400 for a malformed/wrong publishable key rather
    // than 401 (verified directly) — both mean "not authenticated" here.
    const text = await response.text().catch(() => "");
    if (/publishable|unauthenticated|unauthorized/i.test(text) || response.status === 401) {
      throw new MedusaRequestError("unauthorized", "Medusa rejected the request credentials.");
    }
    throw new MedusaRequestError("unsupported", `Medusa returned ${response.status}: ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new MedusaRequestError("unsupported", `Medusa returned ${response.status}.`);
  }

  const json = await response.json().catch(() => {
    throw new MedusaRequestError("invalid_response", "Medusa response was not valid JSON.");
  });

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new MedusaRequestError(
      "invalid_response",
      `Medusa response did not match the expected shape: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  return parsed.data;
}

function basicAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`, "utf8").toString("base64")}`;
}

// ---------------------------------------------------------------------
// Admin API (secret key) — Store admin area only.
// ---------------------------------------------------------------------

export type ConnectionTestResult =
  | { ok: true }
  | { ok: false; reason: MedusaRequestError["reason"]; message: string };

export async function testMedusaConnection(backendUrl: string, secretKey: string): Promise<ConnectionTestResult> {
  try {
    await fetchMedusaJson(
      { backendUrl, path: "/admin/products", searchParams: { limit: "1" }, authHeader: basicAuthHeader(secretKey) },
      z.object({ products: z.array(z.unknown()) }),
    );
    return { ok: true };
  } catch (error) {
    if (error instanceof MedusaRequestError) return { ok: false, reason: error.reason, message: error.message };
    return { ok: false, reason: "unknown", message: error instanceof Error ? error.message : "Unknown error" };
  }
}

const AdminProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  thumbnail: z.string().nullable(),
  handle: z.string().nullable(),
});

export async function listMedusaProducts(
  backendUrl: string,
  secretKey: string,
  opts: { limit?: number; offset?: number; q?: string } = {},
): Promise<{ products: z.infer<typeof AdminProductSchema>[]; count: number }> {
  return fetchMedusaJson(
    {
      backendUrl,
      path: "/admin/products",
      authHeader: basicAuthHeader(secretKey),
      searchParams: {
        limit: String(opts.limit ?? 20),
        offset: String(opts.offset ?? 0),
        fields: "id,title,status,thumbnail,handle",
        ...(opts.q ? { q: opts.q } : {}),
      },
    },
    z.object({ products: z.array(AdminProductSchema), count: z.number() }),
  );
}

/** Creates only a draft. Catalog availability, variants, prices and inventory
 * are completed in native Medusa Admin before publication. */
export async function createMedusaProductDraft(backendUrl: string, secretKey: string, product: { title: string; handle: string; description: string; thumbnail?: string }) {
  return fetchMedusaJson({ backendUrl, path: "/admin/products", authHeader: basicAuthHeader(secretKey), method: "POST", body: { ...product, status: "draft" } }, z.object({ product: z.object({ id: z.string(), title: z.string(), status: z.string() }) }));
}

// ---------------------------------------------------------------------
// Store API (publishable key) — public storefront only.
// ---------------------------------------------------------------------

export const StoreRegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency_code: z.string(),
  countries: z.array(z.object({ iso_2: z.string() })).default([]),
});
export type StoreRegion = z.infer<typeof StoreRegionSchema>;

export async function listStoreRegions(backendUrl: string, publishableKey: string): Promise<StoreRegion[]> {
  const data = await fetchMedusaJson(
    { backendUrl, path: "/store/regions", authHeader: publishableKey },
    z.object({ regions: z.array(StoreRegionSchema) }),
  );
  return data.regions;
}

const CalculatedPriceSchema = z
  .object({ calculated_amount: z.number().nullable(), currency_code: z.string() })
  .nullable();

const StoreVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  sku: z.string().nullable().optional(),
  inventory_quantity: z.number().nullable().optional(),
  manage_inventory: z.boolean().optional(),
  allow_backorder: z.boolean().optional(),
  calculated_price: CalculatedPriceSchema.optional(),
  options: z.array(z.object({ option_id: z.string().optional(), value: z.string() })).optional().default([]),
});
export type StoreVariant = z.infer<typeof StoreVariantSchema>;

const StoreProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  handle: z.string().nullable(),
  thumbnail: z.string().nullable(),
  images: z.array(z.object({ id: z.string(), url: z.string() })).default([]),
  options: z
    .array(z.object({ id: z.string(), title: z.string(), values: z.array(z.object({ id: z.string(), value: z.string() })).default([]) }))
    .default([]),
  variants: z.array(StoreVariantSchema).default([]),
});
export type StoreProduct = z.infer<typeof StoreProductSchema>;

const PRODUCT_FIELDS =
  "id,title,subtitle,description,handle,thumbnail,images.id,images.url,options.id,options.title,options.values.id,options.values.value," +
  "variants.id,variants.title,variants.sku,variants.inventory_quantity,variants.manage_inventory,variants.allow_backorder," +
  "variants.calculated_price.calculated_amount,variants.calculated_price.currency_code," +
  "variants.options.option_id,variants.options.value";

export async function listStoreProducts(
  backendUrl: string,
  publishableKey: string,
  opts: { regionId: string; limit?: number; offset?: number; categoryId?: string; q?: string; productId?: string },
): Promise<{ products: StoreProduct[]; count: number }> {
  return fetchMedusaJson(
    {
      backendUrl,
      path: "/store/products",
      authHeader: publishableKey,
      searchParams: {
        region_id: opts.regionId,
        limit: String(opts.limit ?? 20),
        offset: String(opts.offset ?? 0),
        fields: PRODUCT_FIELDS,
        ...(opts.categoryId ? { category_id: opts.categoryId } : {}),
        ...(opts.q ? { q: opts.q } : {}),
        ...(opts.productId ? { id: opts.productId } : {}),
      },
    },
    z.object({ products: z.array(StoreProductSchema), count: z.number() }),
  );
}

export async function getStoreProductByHandle(
  backendUrl: string,
  publishableKey: string,
  handle: string,
  regionId: string,
): Promise<StoreProduct | null> {
  const data = await fetchMedusaJson(
    {
      backendUrl,
      path: "/store/products",
      authHeader: publishableKey,
      searchParams: { handle, region_id: regionId, fields: PRODUCT_FIELDS, limit: "1" },
    },
    z.object({ products: z.array(StoreProductSchema) }),
  );
  return data.products[0] ?? null;
}

const CartLineItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  quantity: z.number(),
  unit_price: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  variant_id: z.string().nullable().optional(),
});

const AddressSchema = z.object({
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  address_1: z.string().nullable().optional(),
  address_2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});
export type StoreAddress = z.infer<typeof AddressSchema>;

// `name` is present on a *shipping option listing* (ShippingOptionSchema
// below, from /store/shipping-options) but NOT on a cart's own
// shipping_methods[] entries (confirmed against a live response: an
// added method has amount/shipping_option_id/id/tax_lines/adjustments,
// no name) — this schema was wrong until a real checkout run (not a
// hand-crafted test) surfaced it as a zod parse failure.
const ShippingMethodSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  shipping_option_id: z.string().nullable().optional(),
});

const PaymentSessionSchema = z.object({
  id: z.string(),
  provider_id: z.string(),
  status: z.string().optional(),
  // Provider-specific — e.g. Stripe's client_secret lives here. Passed
  // through opaquely; only the specific keys a given provider's client
  // widget needs are read by callers, never logged wholesale (may
  // contain a payment-session client secret).
  data: z.record(z.string(), z.unknown()).optional(),
});

const PaymentCollectionSchema = z.object({
  id: z.string(),
  currency_code: z.string(),
  amount: z.number().nullable().optional(),
  status: z.string().optional(),
  payment_sessions: z.array(PaymentSessionSchema).optional().default([]),
});
export type StorePaymentCollection = z.infer<typeof PaymentCollectionSchema>;

const CartSchema = z.object({
  id: z.string(),
  currency_code: z.string(),
  region_id: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  items: z.array(CartLineItemSchema).default([]),
  item_total: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  subtotal: z.number().nullable().optional(),
  tax_total: z.number().nullable().optional(),
  shipping_total: z.number().nullable().optional(),
  shipping_address: AddressSchema.nullable().optional(),
  billing_address: AddressSchema.nullable().optional(),
  shipping_methods: z.array(ShippingMethodSchema).optional().default([]),
  payment_collection: PaymentCollectionSchema.nullable().optional(),
  completed_at: z.string().nullable().optional(),
});
export type StoreCart = z.infer<typeof CartSchema>;

const ShippingOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  calculated_price: z
    .object({ calculated_amount: z.number().nullable(), currency_code: z.string() })
    .nullable()
    .optional(),
  insufficient_inventory: z.boolean().optional(),
});
export type StoreShippingOption = z.infer<typeof ShippingOptionSchema>;

const PaymentProviderSchema = z.object({ id: z.string(), is_enabled: z.boolean().optional() });
export type StorePaymentProvider = z.infer<typeof PaymentProviderSchema>;

export async function createStoreCart(
  backendUrl: string,
  publishableKey: string,
  regionId: string,
): Promise<StoreCart> {
  const data = await fetchMedusaJson(
    { backendUrl, path: "/store/carts", authHeader: publishableKey, method: "POST", body: { region_id: regionId } },
    z.object({ cart: CartSchema }),
  );
  return data.cart;
}

export async function getStoreCart(
  backendUrl: string,
  publishableKey: string,
  cartId: string,
): Promise<StoreCart | null> {
  try {
    const data = await fetchMedusaJson(
      { backendUrl, path: `/store/carts/${cartId}`, authHeader: publishableKey },
      z.object({ cart: CartSchema }),
    );
    return data.cart;
  } catch (error) {
    if (error instanceof MedusaRequestError && /returned 404/.test(error.message)) return null;
    throw error;
  }
}

export type CartMutationResult = { ok: true; cart: StoreCart } | { ok: false; reason: string; message: string };

export async function addStoreCartLineItem(
  backendUrl: string,
  publishableKey: string,
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<CartMutationResult> {
  try {
    const data = await fetchMedusaJson(
      {
        backendUrl,
        path: `/store/carts/${cartId}/line-items`,
        authHeader: publishableKey,
        method: "POST",
        body: { variant_id: variantId, quantity },
      },
      z.object({ cart: CartSchema }),
    );
    return { ok: true, cart: data.cart };
  } catch (error) {
    return { ok: false, reason: "add_failed", message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function updateStoreCartLineItem(
  backendUrl: string,
  publishableKey: string,
  cartId: string,
  lineItemId: string,
  quantity: number,
): Promise<CartMutationResult> {
  try {
    const data = await fetchMedusaJson(
      {
        backendUrl,
        path: `/store/carts/${cartId}/line-items/${lineItemId}`,
        authHeader: publishableKey,
        method: "POST",
        body: { quantity },
      },
      z.object({ cart: CartSchema }),
    );
    return { ok: true, cart: data.cart };
  } catch (error) {
    return { ok: false, reason: "update_failed", message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function removeStoreCartLineItem(
  backendUrl: string,
  publishableKey: string,
  cartId: string,
  lineItemId: string,
): Promise<CartMutationResult> {
  try {
    const data = await fetchMedusaJson(
      { backendUrl, path: `/store/carts/${cartId}/line-items/${lineItemId}`, authHeader: publishableKey, method: "DELETE" },
      z.object({ deleted: z.boolean().optional(), parent: CartSchema.optional(), cart: CartSchema.optional() }),
    );
    const cart = data.cart ?? data.parent;
    if (!cart) throw new Error("Medusa did not return the updated cart after deletion.");
    return { ok: true, cart };
  } catch (error) {
    return { ok: false, reason: "remove_failed", message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function updateStoreCart(
  backendUrl: string,
  publishableKey: string,
  cartId: string,
  body: { email?: string; shipping_address?: StoreAddress; billing_address?: StoreAddress },
): Promise<CartMutationResult> {
  try {
    const data = await fetchMedusaJson(
      { backendUrl, path: `/store/carts/${cartId}`, authHeader: publishableKey, method: "POST", body },
      z.object({ cart: CartSchema }),
    );
    return { ok: true, cart: data.cart };
  } catch (error) {
    return { ok: false, reason: "update_failed", message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function listShippingOptions(
  backendUrl: string,
  publishableKey: string,
  cartId: string,
): Promise<StoreShippingOption[]> {
  const data = await fetchMedusaJson(
    { backendUrl, path: "/store/shipping-options", authHeader: publishableKey, searchParams: { cart_id: cartId } },
    z.object({ shipping_options: z.array(ShippingOptionSchema) }),
  );
  return data.shipping_options;
}

export async function addShippingMethod(
  backendUrl: string,
  publishableKey: string,
  cartId: string,
  optionId: string,
): Promise<CartMutationResult> {
  try {
    const data = await fetchMedusaJson(
      {
        backendUrl,
        path: `/store/carts/${cartId}/shipping-methods`,
        authHeader: publishableKey,
        method: "POST",
        body: { option_id: optionId },
      },
      z.object({ cart: CartSchema }),
    );
    return { ok: true, cart: data.cart };
  } catch (error) {
    return { ok: false, reason: "shipping_failed", message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function listPaymentProviders(
  backendUrl: string,
  publishableKey: string,
  regionId: string,
): Promise<StorePaymentProvider[]> {
  const data = await fetchMedusaJson(
    { backendUrl, path: "/store/payment-providers", authHeader: publishableKey, searchParams: { region_id: regionId } },
    z.object({ payment_providers: z.array(PaymentProviderSchema) }),
  );
  return data.payment_providers;
}

export type PaymentCollectionResult =
  | { ok: true; paymentCollection: StorePaymentCollection }
  | { ok: false; message: string };

export async function createPaymentCollection(
  backendUrl: string,
  publishableKey: string,
  cartId: string,
): Promise<PaymentCollectionResult> {
  try {
    const data = await fetchMedusaJson(
      { backendUrl, path: "/store/payment-collections", authHeader: publishableKey, method: "POST", body: { cart_id: cartId } },
      z.object({ payment_collection: PaymentCollectionSchema }),
    );
    return { ok: true, paymentCollection: data.payment_collection };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function initPaymentSession(
  backendUrl: string,
  publishableKey: string,
  paymentCollectionId: string,
  providerId: string,
): Promise<PaymentCollectionResult> {
  try {
    const data = await fetchMedusaJson(
      {
        backendUrl,
        path: `/store/payment-collections/${paymentCollectionId}/payment-sessions`,
        authHeader: publishableKey,
        method: "POST",
        body: { provider_id: providerId },
      },
      z.object({ payment_collection: PaymentCollectionSchema }),
    );
    return { ok: true, paymentCollection: data.payment_collection };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

const OrderSchema = z.object({
  id: z.string(),
  display_id: z.number().nullable().optional(),
  status: z.string(),
  email: z.string().nullable().optional(),
  currency_code: z.string(),
  total: z.number().nullable().optional(),
  item_total: z.number().nullable().optional(),
  shipping_total: z.number().nullable().optional(),
  tax_total: z.number().nullable().optional(),
  payment_status: z.string().optional(),
  fulfillment_status: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        quantity: z.number(),
        thumbnail: z.string().nullable().optional(),
        total: z.number().nullable().optional(),
      }),
    )
    .default([]),
  shipping_address: AddressSchema.nullable().optional(),
});
export type StoreOrder = z.infer<typeof OrderSchema>;

/**
 * Medusa's cart completion is idempotent at the Medusa level — verified
 * directly: calling this twice on the same cart returns the SAME order
 * both times, not a duplicate. That's the actual safety mechanism this
 * relies on for double-click/retry protection; this function doesn't add
 * a second one on top (an idempotency-key header alone wouldn't make
 * every endpoint safe, and isn't needed here since Medusa already
 * handles the one operation that matters).
 */
export type CompleteCartResult =
  | { type: "order"; order: StoreOrder }
  | { type: "cart_error"; message: string }
  | { type: "request_error"; message: string };

export async function completeCart(backendUrl: string, publishableKey: string, cartId: string): Promise<CompleteCartResult> {
  try {
    const data = await fetchMedusaJson(
      { backendUrl, path: `/store/carts/${cartId}/complete`, authHeader: publishableKey, method: "POST" },
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("order"), order: OrderSchema }),
        z.object({ type: z.literal("cart"), cart: CartSchema, error: z.object({ message: z.string() }).optional() }),
      ]),
    );
    if (data.type === "order") return { type: "order", order: data.order };
    return { type: "cart_error", message: data.error?.message ?? "Payment was not completed." };
  } catch (error) {
    return { type: "request_error", message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getStoreOrder(backendUrl: string, publishableKey: string, orderId: string): Promise<StoreOrder | null> {
  try {
    const data = await fetchMedusaJson(
      { backendUrl, path: `/store/orders/${orderId}`, authHeader: publishableKey },
      z.object({ order: OrderSchema }),
    );
    return data.order;
  } catch (error) {
    if (error instanceof MedusaRequestError && /returned 404/.test(error.message)) return null;
    throw error;
  }
}

export { MedusaRequestError };
