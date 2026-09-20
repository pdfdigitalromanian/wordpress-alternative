import { useState } from "react";
import { data, Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { resolveSiteIdByHost } from "~/lib/site-resolution.server";
import { resolveStorefront, resolveCart, addStoreCartLineItem } from "~/lib/commerce.server";
import { formatMoney } from "~/lib/money";
import { getStoreProductByHandle } from "~/lib/medusa.server";
import type { Route } from "./+types/product-detail";

export async function loader({ request, params }: Route.LoaderArgs) {
  const siteId = await resolveSiteIdByHost(request);
  if (!siteId) throw new Response("Not Found", { status: 404 });

  const storefront = await resolveStorefront(siteId);
  if (!storefront.ready) {
    throw new Response(`Store not available: ${storefront.message}`, { status: 503 });
  }

  const product = await getStoreProductByHandle(storefront.backendUrl, storefront.publishableKey, params.handle!, storefront.region.id);
  if (!product) throw new Response("Not Found", { status: 404 });

  return { product, currencyCode: storefront.region.currency_code };
}

export async function action({ request, params }: Route.ActionArgs) {
  const siteId = await resolveSiteIdByHost(request);
  if (!siteId) return data({ error: "Not found" }, { status: 404 });

  const storefront = await resolveStorefront(siteId);
  if (!storefront.ready) return data({ error: storefront.message }, { status: 503 });

  const formData = await request.formData();
  const variantId = String(formData.get("variant_id") ?? "");
  const rawQuantity = Number(formData.get("quantity") ?? "1");
  const quantity = Number.isFinite(rawQuantity) ? Math.min(Math.max(Math.floor(rawQuantity), 1), 99) : 1;

  if (!variantId) return data({ error: "Choose an option first." }, { status: 400 });

  const { cart, setCookieHeader } = await resolveCart(request, storefront);
  const result = await addStoreCartLineItem(storefront.backendUrl, storefront.publishableKey, cart.id, variantId, quantity);

  const headers = new Headers();
  if (setCookieHeader) headers.set("Set-Cookie", setCookieHeader);

  if (!result.ok) {
    // Medusa's own message (e.g. "insufficient_inventory") — shown
    // honestly rather than translated into a generic "added!".
    return data({ error: result.message }, { status: 400, headers });
  }
  return data({ ok: true, itemCount: result.cart.items.reduce((n, i) => n + i.quantity, 0) }, { headers });
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Product" }];
  return [{ title: loaderData.product.title }, { name: "description", content: loaderData.product.description ?? "" }];
}

export default function ProductDetail() {
  const { product, currencyCode } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const selectedVariant = product.variants.find((v) => v.id === variantId);

  const outOfStock =
    selectedVariant &&
    selectedVariant.manage_inventory &&
    !selectedVariant.allow_backorder &&
    (selectedVariant.inventory_quantity ?? 0) <= 0;

  return (
    <main>
      <h1>{product.title}</h1>
      {product.images.length > 0 ? (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {product.images.map((img) => (
            <img key={img.id} src={img.url} alt={product.title} style={{ maxWidth: 300, height: "auto" }} />
          ))}
        </div>
      ) : null}
      {product.description ? <p>{product.description}</p> : null}

      {product.variants.length === 0 ? (
        <p>This product has no purchasable options configured.</p>
      ) : (
        <Form method="post">
          <div className="field">
            <label htmlFor="variant">Option</label>
            <select
              id="variant"
              name="variant_id"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className="input"
            >
              {product.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                  {v.sku ? ` (${v.sku})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            {selectedVariant?.calculated_price?.calculated_amount != null
              ? formatMoney(selectedVariant.calculated_price.calculated_amount, currencyCode)
              : "Price unavailable"}
          </div>

          <div className="field">
            <label htmlFor="quantity">Quantity</label>
            <input id="quantity" name="quantity" type="number" min={1} max={99} defaultValue={1} className="input" />
          </div>

          {outOfStock ? (
            <p role="status">Out of stock.</p>
          ) : (
            <button type="submit" disabled={submitting} className="btn">
              {submitting ? "Adding…" : "Add to cart"}
            </button>
          )}
        </Form>
      )}

      {actionData && "error" in actionData ? <p role="alert">{actionData.error}</p> : null}
      {actionData && "ok" in actionData ? (
        <p role="status">
          Added to cart ({actionData.itemCount} item{actionData.itemCount === 1 ? "" : "s"} total). <a href="/cart">View cart</a>
        </p>
      ) : null}
    </main>
  );
}
