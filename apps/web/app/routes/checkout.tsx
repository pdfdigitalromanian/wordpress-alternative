import { data, Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { resolveSiteIdByHost } from "~/lib/site-resolution.server";
import {
  resolveStorefront,
  peekCart,
  resolveCart,
  grantOrderAccessHeader,
  clearCartCookieHeader,
} from "~/lib/commerce.server";
import {
  updateStoreCart,
  listShippingOptions,
  addShippingMethod,
  listPaymentProviders,
  createPaymentCollection,
  initPaymentSession,
  completeCart,
  type StoreShippingOption,
  type StorePaymentProvider,
} from "~/lib/medusa.server";
import { formatMoney } from "~/lib/money";
import type { Route } from "./+types/checkout";

export async function loader({ request }: Route.LoaderArgs) {
  const siteId = await resolveSiteIdByHost(request);
  if (!siteId) throw new Response("Not Found", { status: 404 });

  const storefront = await resolveStorefront(siteId);
  if (!storefront.ready) {
    return data({ ready: false as const, message: storefront.message });
  }

  const peek = await peekCart(request, storefront);
  if (peek.status === "unavailable") {
    return data({ ready: true as const, cartState: "unavailable" as const, message: peek.message });
  }
  if (peek.status === "none") {
    return data({ ready: true as const, cartState: "empty" as const });
  }

  const cart = peek.cart;
  if (cart.items.length === 0) {
    return data({ ready: true as const, cartState: "empty" as const });
  }

  // Checkout readiness for THIS cart specifically (work order SS3C) —
  // eligible shipping and available payment providers, not just "the
  // Admin API responded 200 once at Store setup time".
  let shippingOptions: StoreShippingOption[] = [];
  let shippingError: string | null = null;
  try {
    shippingOptions = await listShippingOptions(storefront.backendUrl, storefront.publishableKey, cart.id);
  } catch (error) {
    shippingError = error instanceof Error ? error.message : "Could not load shipping options.";
  }

  let paymentProviders: StorePaymentProvider[] = [];
  let paymentError: string | null = null;
  try {
    paymentProviders = await listPaymentProviders(storefront.backendUrl, storefront.publishableKey, storefront.region.id);
  } catch (error) {
    paymentError = error instanceof Error ? error.message : "Could not load payment providers.";
  }

  const stripeProvider = paymentProviders.find((p) => p.id.includes("stripe") && p.is_enabled !== false);
  const manualProvider = paymentProviders.find((p) => p.id.includes("system_default") && p.is_enabled !== false);

  return data({
    ready: true as const,
    cartState: "active" as const,
    cart,
    currencyCode: storefront.region.currency_code,
    shippingOptions,
    shippingError,
    paymentProviders,
    paymentError,
    hasStripe: !!stripeProvider,
    stripeProviderId: stripeProvider?.id ?? null,
    hasManual: !!manualProvider,
    manualProviderId: manualProvider?.id ?? null,
  });
}

export async function action({ request }: Route.ActionArgs) {
  const siteId = await resolveSiteIdByHost(request);
  if (!siteId) return data({ intent: "unknown", ok: false, error: "Not found" }, { status: 404 });

  const storefront = await resolveStorefront(siteId);
  if (!storefront.ready) {
    return data({ intent: "unknown", ok: false, error: storefront.message }, { status: 503 });
  }

  const cartResult = await resolveCart(request, storefront);
  if (cartResult.status === "unavailable") {
    return data({ intent: "unknown", ok: false, error: cartResult.message }, { status: 503 });
  }
  const cart = cartResult.cart;
  const headers = new Headers();
  if (cartResult.setCookieHeader) headers.append("Set-Cookie", cartResult.setCookieHeader);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "update-info") {
    const email = String(formData.get("email") ?? "").trim();
    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();
    const address1 = String(formData.get("address_1") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const postalCode = String(formData.get("postal_code") ?? "").trim();
    const countryCode = String(formData.get("country_code") ?? "")
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      return data({ intent, ok: false, error: "A valid email is required." }, { status: 400, headers });
    }
    if (!firstName || !lastName || !address1 || !city || !postalCode || !countryCode) {
      return data({ intent, ok: false, error: "All shipping address fields are required." }, {
        status: 400,
        headers,
      });
    }
    // Only countries the configured region actually supports — never an
    // arbitrary one accepted client-side.
    const allowedCountries = new Set((formData.get("_allowed_countries") ?? "").toString().split(",").filter(Boolean));
    if (allowedCountries.size > 0 && !allowedCountries.has(countryCode)) {
      return data(
        { intent, ok: false, error: "That country isn't supported by this store's configured region." },
        { status: 400, headers },
      );
    }

    const shippingAddress = {
      first_name: firstName,
      last_name: lastName,
      address_1: address1,
      city,
      postal_code: postalCode,
      country_code: countryCode,
    };
    const result = await updateStoreCart(storefront.backendUrl, storefront.publishableKey, cart.id, {
      email,
      shipping_address: shippingAddress,
      billing_address: shippingAddress,
    });
    if (!result.ok) return data({ intent, ok: false, error: result.message }, { status: 400, headers });
    return data({ intent, ok: true }, { headers });
  }

  if (intent === "select-shipping") {
    const optionId = String(formData.get("option_id") ?? "");
    if (!optionId) return data({ intent, ok: false, error: "Choose a shipping option." }, { status: 400, headers });

    // Confirm the submitted option is actually eligible for this cart
    // before sending it upstream — reject identifier manipulation here
    // rather than letting Medusa be the only check.
    const eligible = await listShippingOptions(storefront.backendUrl, storefront.publishableKey, cart.id).catch(() => []);
    if (!eligible.some((o) => o.id === optionId)) {
      return data({ intent, ok: false, error: "That shipping option isn't available for this cart." }, {
        status: 400,
        headers,
      });
    }

    const result = await addShippingMethod(storefront.backendUrl, storefront.publishableKey, cart.id, optionId);
    if (!result.ok) return data({ intent, ok: false, error: result.message }, { status: 400, headers });
    return data({ intent, ok: true }, { headers });
  }

  if (intent === "init-payment") {
    const providerId = String(formData.get("provider_id") ?? "");
    if (!providerId) return data({ intent, ok: false, error: "Choose a payment method." }, { status: 400, headers });

    const eligible = await listPaymentProviders(storefront.backendUrl, storefront.publishableKey, storefront.region.id);
    if (!eligible.some((p) => p.id === providerId)) {
      return data({ intent, ok: false, error: "That payment method isn't available." }, {
        status: 400,
        headers,
      });
    }

    let collectionId = cart.payment_collection?.id;
    if (!collectionId) {
      const created = await createPaymentCollection(storefront.backendUrl, storefront.publishableKey, cart.id);
      if (!created.ok) return data({ intent, ok: false, error: created.message }, { status: 400, headers });
      collectionId = created.paymentCollection.id;
    }

    const session = await initPaymentSession(storefront.backendUrl, storefront.publishableKey, collectionId, providerId);
    if (!session.ok) return data({ intent, ok: false, error: session.message }, { status: 400, headers });

    return data({ intent, ok: true }, { headers });
  }

  if (intent === "complete-manual") {
    // Deliberately separate action from any future Stripe completion
    // path (work order SS3/SS6): this creates a real Medusa order via
    // the "system default" provider, which auto-authorizes but this is
    // NOT a verified payment — reported as such, both in this code and
    // in the confirmation page's own copy.
    if (!cart.shipping_address || !cart.email) {
      return data({ intent, ok: false, error: "Add your details and address first." }, {
        status: 400,
        headers,
      });
    }
    if (cart.shipping_methods.length === 0) {
      return data({ intent, ok: false, error: "Choose a shipping option first." }, { status: 400, headers });
    }

    // completeCart requires an initiated payment session (confirmed live:
    // "Payment collection has not been initiated for cart" from Medusa
    // when this step was skipped) — the one-click manual-order button
    // does both steps itself rather than requiring a separate "3.
    // Payment" click first, since there's only one provider to pick here.
    const manualProviderId = String(formData.get("provider_id") ?? "");
    if (!manualProviderId) {
      return data({ intent, ok: false, error: "No manual test payment provider is available." }, { status: 400, headers });
    }
    let collectionId = cart.payment_collection?.id;
    if (!collectionId) {
      const created = await createPaymentCollection(storefront.backendUrl, storefront.publishableKey, cart.id);
      if (!created.ok) return data({ intent, ok: false, error: created.message }, { status: 400, headers });
      collectionId = created.paymentCollection.id;
    }
    const alreadyInitialized = cart.payment_collection?.payment_sessions?.some((s) => s.provider_id === manualProviderId);
    if (!alreadyInitialized) {
      const session = await initPaymentSession(storefront.backendUrl, storefront.publishableKey, collectionId, manualProviderId);
      if (!session.ok) return data({ intent, ok: false, error: session.message }, { status: 400, headers });
    }

    const result = await completeCart(storefront.backendUrl, storefront.publishableKey, cart.id);
    if (result.type === "order") {
      const orderAccessHeader = await grantOrderAccessHeader(siteId, result.order.id);
      headers.append("Set-Cookie", orderAccessHeader);
      headers.append("Set-Cookie", await clearCartCookieHeader(siteId));
      // A real redirect, not a JSON field the UI has to notice and act
      // on — the visitor lands on the confirmation page immediately,
      // the same way a successful order should behave.
      throw redirect("/checkout/confirmation", { headers });
    }
    return data({ intent, ok: false, error: result.message }, { status: 400, headers });
  }

  return data({ intent, ok: false, error: "Unknown action." }, { status: 400, headers });
}

export function meta() {
  return [{ title: "Checkout" }, { name: "robots", content: "noindex" }];
}

export function headers() {
  // Never publicly cache checkout — it's per-visitor cart/session state.
  return { "Cache-Control": "private, no-store" };
}

export default function Checkout() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  if (!loaderData.ready) {
    return (
      <main className="storefront-page">
        <h1>Checkout</h1>
        <p role="status">This store isn't set up for checkout yet: {loaderData.message}</p>
      </main>
    );
  }

  if (loaderData.cartState === "unavailable") {
    return (
      <main className="storefront-page">
        <h1>Checkout</h1>
        <p role="alert">Could not load your cart right now: {loaderData.message}. Please try again.</p>
      </main>
    );
  }

  if (loaderData.cartState === "empty") {
    return (
      <main className="storefront-page">
        <h1>Checkout</h1>
        <p>
          Your cart is empty. <Link to="/shop">Continue shopping</Link>
        </p>
      </main>
    );
  }

  const { cart, currencyCode, shippingOptions, paymentProviders, hasStripe, hasManual, manualProviderId } = loaderData;
  const hasAddress = !!cart.shipping_address && !!cart.email;
  const hasShipping = cart.shipping_methods.length > 0;

  return (
    <main className="storefront-page">
      <h1>Checkout</h1>

      <section className="card">
        <h2>1. Contact and shipping address</h2>
        <Form method="post">
          <input type="hidden" name="intent" value="update-info" />
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input" defaultValue={cart.email ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="first_name">First name</label>
            <input id="first_name" name="first_name" required className="input" defaultValue={cart.shipping_address?.first_name ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="last_name">Last name</label>
            <input id="last_name" name="last_name" required className="input" defaultValue={cart.shipping_address?.last_name ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="address_1">Address</label>
            <input id="address_1" name="address_1" required className="input" defaultValue={cart.shipping_address?.address_1 ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="city">City</label>
            <input id="city" name="city" required className="input" defaultValue={cart.shipping_address?.city ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="postal_code">Postal code</label>
            <input
              id="postal_code"
              name="postal_code"
              required
              className="input"
              defaultValue={cart.shipping_address?.postal_code ?? ""}
            />
          </div>
          <div className="field">
            <label htmlFor="country_code">Country code (e.g. dk)</label>
            <input
              id="country_code"
              name="country_code"
              required
              className="input"
              defaultValue={cart.shipping_address?.country_code ?? ""}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn">
            Save address
          </button>
        </Form>
      </section>

      <section className="card">
        <h2>2. Shipping</h2>
        {shippingOptions.length === 0 ? (
          <p role="status">No shipping options available — add a valid address first.</p>
        ) : (
          <ul>
            {shippingOptions.map((option) => (
              <li key={option.id}>
                <Form method="post" style={{ display: "inline" }}>
                  <input type="hidden" name="intent" value="select-shipping" />
                  <input type="hidden" name="option_id" value={option.id} />
                  <button type="submit" disabled={submitting || !hasAddress} className="btn-secondary">
                    {cart.shipping_methods.some((m) => m.shipping_option_id === option.id) ? "✓ " : ""}
                    {option.name} — {formatMoney(option.calculated_price?.calculated_amount ?? null, currencyCode)}
                  </button>
                </Form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>3. Payment</h2>
        {paymentProviders.length === 0 ? (
          <p role="status">Test payment is not configured for this store yet.</p>
        ) : (
          <>
            {hasStripe ? (
              <p role="status">
                Stripe test-mode payment UI is not wired into this build yet (no Stripe provider was configured when this
                was written) — the provider IS available from this backend, but the client-side Elements flow is not
                implemented here.
              </p>
            ) : null}
            {hasManual ? (
              <Form method="post">
                <input type="hidden" name="intent" value="complete-manual" />
                <input type="hidden" name="provider_id" value={manualProviderId ?? ""} />
                <p role="status">
                  <strong>No real payment provider is configured for this store.</strong> This places a real Medusa order
                  for testing the order-creation flow — it is NOT a verified payment and no money moves.
                </p>
                <button type="submit" disabled={submitting || !hasAddress || !hasShipping} className="btn">
                  {submitting ? "Placing order…" : "Place manual test order (no real payment)"}
                </button>
              </Form>
            ) : null}
          </>
        )}
      </section>

      <section>
        <h2>Order summary</h2>
        <dl>
          <dt>Items</dt>
          <dd>{formatMoney(cart.item_total, currencyCode)}</dd>
          <dt>Shipping</dt>
          <dd>{formatMoney(cart.shipping_total, currencyCode)}</dd>
          <dt>Total</dt>
          <dd>{formatMoney(cart.total, currencyCode)}</dd>
        </dl>
      </section>

      {actionData && "error" in actionData ? <p role="alert">{String(actionData.error)}</p> : null}
    </main>
  );
}
