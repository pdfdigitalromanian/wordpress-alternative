import { data, Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { resolveSiteIdByHost } from "~/lib/site-resolution.server";
import {
  resolveStorefront,
  resolveCart,
  updateStoreCartLineItem,
  removeStoreCartLineItem,
} from "~/lib/commerce.server";
import { formatMoney } from "~/lib/money";
import type { Route } from "./+types/cart";

export async function loader({ request }: Route.LoaderArgs) {
  const siteId = await resolveSiteIdByHost(request);
  if (!siteId) throw new Response("Not Found", { status: 404 });

  const storefront = await resolveStorefront(siteId);
  if (!storefront.ready) {
    return data({ ready: false as const, message: storefront.message, cart: null });
  }

  const { cart, setCookieHeader } = await resolveCart(request, storefront);
  const headers = new Headers();
  if (setCookieHeader) headers.set("Set-Cookie", setCookieHeader);

  return data({ ready: true as const, cart, currencyCode: storefront.region.currency_code }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const siteId = await resolveSiteIdByHost(request);
  if (!siteId) return data({ error: "Not found" }, { status: 404 });

  const storefront = await resolveStorefront(siteId);
  if (!storefront.ready) return data({ error: storefront.message }, { status: 503 });

  const { cart, setCookieHeader } = await resolveCart(request, storefront);
  const headers = new Headers();
  if (setCookieHeader) headers.set("Set-Cookie", setCookieHeader);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const lineItemId = String(formData.get("line_item_id") ?? "");

  if (intent === "update-quantity") {
    const rawQuantity = Number(formData.get("quantity") ?? "1");
    const quantity = Number.isFinite(rawQuantity) ? Math.min(Math.max(Math.floor(rawQuantity), 1), 99) : 1;
    const result = await updateStoreCartLineItem(storefront.backendUrl, storefront.publishableKey, cart.id, lineItemId, quantity);
    if (!result.ok) return data({ error: result.message }, { status: 400, headers });
    return data({ ok: true }, { headers });
  }

  if (intent === "remove") {
    const result = await removeStoreCartLineItem(storefront.backendUrl, storefront.publishableKey, cart.id, lineItemId);
    if (!result.ok) return data({ error: result.message }, { status: 400, headers });
    return data({ ok: true }, { headers });
  }

  return data({ error: "Unknown action." }, { status: 400, headers });
}

export function meta() {
  return [{ title: "Cart" }];
}

export default function Cart() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  if (!loaderData.ready) {
    return (
      <main>
        <h1>Cart</h1>
        <p role="status">This store isn't set up yet: {loaderData.message}</p>
      </main>
    );
  }

  const { cart, currencyCode } = loaderData;

  return (
    <main>
      <h1>Cart</h1>
      {cart.items.length === 0 ? (
        <p>
          Your cart is empty. <Link to="/shop">Continue shopping</Link>
        </p>
      ) : (
        <>
          <ul>
            {cart.items.map((item) => (
              <li key={item.id} style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                {item.thumbnail ? <img src={item.thumbnail} alt="" width={48} height={48} style={{ objectFit: "cover" }} /> : null}
                <span>{item.title}</span>
                <Form method="post" style={{ display: "inline-flex", gap: "0.5rem" }}>
                  <input type="hidden" name="intent" value="update-quantity" />
                  <input type="hidden" name="line_item_id" value={item.id} />
                  <input
                    type="number"
                    name="quantity"
                    min={1}
                    max={99}
                    defaultValue={item.quantity}
                    className="input"
                    style={{ width: "4rem" }}
                  />
                  <button type="submit" disabled={submitting} className="btn-secondary">
                    Update
                  </button>
                </Form>
                <span>{formatMoney(item.total, currencyCode)}</span>
                <Form method="post">
                  <input type="hidden" name="intent" value="remove" />
                  <input type="hidden" name="line_item_id" value={item.id} />
                  <button type="submit" disabled={submitting} className="btn-secondary">
                    Remove
                  </button>
                </Form>
              </li>
            ))}
          </ul>

          <dl>
            <dt>Subtotal</dt>
            <dd>{formatMoney(cart.subtotal, currencyCode)}</dd>
            <dt>Shipping</dt>
            <dd>{formatMoney(cart.shipping_total, currencyCode)}</dd>
            <dt>Tax</dt>
            <dd>{formatMoney(cart.tax_total, currencyCode)}</dd>
            <dt>Total</dt>
            <dd>{formatMoney(cart.total, currencyCode)}</dd>
          </dl>

          {/* Checkout (guest checkout, shipping/payment) is the next
              milestone (work order SS6) — deliberately not implemented
              here, not hidden as a silent no-op. */}
          <button type="button" disabled className="btn" title="Checkout is not implemented yet">
            Checkout (coming soon)
          </button>
        </>
      )}

      {actionData && "error" in actionData ? <p role="alert">{actionData.error}</p> : null}
    </main>
  );
}
