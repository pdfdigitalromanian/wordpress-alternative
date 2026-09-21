import { data, Link, useLoaderData } from "react-router";
import { resolveSiteIdByHost } from "~/lib/site-resolution.server";
import { resolveStorefront, getAuthorizedOrderId } from "~/lib/commerce.server";
import { getStoreOrder } from "~/lib/medusa.server";
import type { Route } from "./+types/checkout-confirmation";

/**
 * No order ID in the URL at all (see routes.ts) — access is entirely via
 * the signed, site-scoped `drcms_order_<siteId>` cookie set by
 * checkout.tsx on successful completion. Medusa's own /store/orders/:id
 * accepts any order ID with just the publishable key (verified directly
 * — no customer/session binding at that layer), so this route is the
 * actual access boundary, not a passthrough to it.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const siteId = await resolveSiteIdByHost(request);
  if (!siteId) throw new Response("Not Found", { status: 404 });

  const storefront = await resolveStorefront(siteId);
  if (!storefront.ready) {
    return data({ ready: false as const, message: storefront.message });
  }

  const orderId = await getAuthorizedOrderId(request, siteId);
  if (!orderId) {
    // Never distinguish "no cookie" from "cookie for a different order"
    // — both mean "you don't have access to view an order here".
    return data({ ready: true as const, authorized: false as const });
  }

  const order = await getStoreOrder(storefront.backendUrl, storefront.publishableKey, orderId);
  if (!order) {
    return data({ ready: true as const, authorized: false as const });
  }

  return data({ ready: true as const, authorized: true as const, order, currencyCode: storefront.region.currency_code });
}

export function meta() {
  return [{ title: "Order confirmation" }, { name: "robots", content: "noindex" }];
}

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export default function CheckoutConfirmation() {
  const loaderData = useLoaderData<typeof loader>();

  if (!loaderData.ready) {
    return (
      <main>
        <h1>Order confirmation</h1>
        <p role="status">{loaderData.message}</p>
      </main>
    );
  }

  if (!loaderData.authorized) {
    return (
      <main>
        <h1>Order confirmation</h1>
        <p role="alert">
          No order found for this session. <Link to="/shop">Continue shopping</Link>
        </p>
      </main>
    );
  }

  const { order, currencyCode } = loaderData;
  const isManualTestOrder = order.payment_status !== "captured";

  return (
    <main>
      <h1>Order confirmed</h1>
      {isManualTestOrder ? (
        <p role="status">
          <strong>This was placed with the manual test-order flow — it is NOT a verified real payment.</strong> Payment
          status: {order.payment_status ?? "unknown"}.
        </p>
      ) : null}
      <p>
        Order #{order.display_id ?? order.id} — {order.status}
      </p>
      <p>Confirmation sent to: {order.email}</p>
      <ul>
        {order.items.map((item) => (
          <li key={item.id}>
            {item.title} × {item.quantity}
          </li>
        ))}
      </ul>
      <p>Total: {order.total != null ? `${(order.total).toFixed(2)} ${currencyCode.toUpperCase()}` : "—"}</p>
      <p>Fulfillment: {order.fulfillment_status ?? "not_fulfilled"}</p>
      <p>
        <Link to="/shop">Continue shopping</Link>
      </p>
    </main>
  );
}
