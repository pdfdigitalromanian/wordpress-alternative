import { ShopNavigation } from "~/components/shop-navigation";
import { Form, Link, useLoaderData, useNavigation } from "react-router";
import { resolveSiteIdByHost } from "~/lib/site-resolution.server";
import { resolveStorefront } from "~/lib/commerce.server";
import { formatMoney } from "~/lib/money";
import { listStoreProducts } from "~/lib/medusa.server";
import type { Route } from "./+types/shop";

const PAGE_SIZE = 12;

export async function loader({ request }: Route.LoaderArgs) {
  const siteId = await resolveSiteIdByHost(request);
  if (!siteId) throw new Response("Not Found", { status: 404 });

  const storefront = await resolveStorefront(siteId);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").slice(0, 200);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0") || 0);

  if (!storefront.ready) {
    return { ready: false as const, message: storefront.message, products: [], count: 0, offset };
  }

  const { products, count } = await listStoreProducts(storefront.backendUrl, storefront.publishableKey, {
    regionId: storefront.region.id,
    limit: PAGE_SIZE,
    offset,
    q,
  });

  return {
    ready: true as const,
    q,
    products: products.map((p) => {
      const cheapest = p.variants
        .filter((v) => v.calculated_price?.calculated_amount != null)
        .sort((a, b) => a.calculated_price!.calculated_amount! - b.calculated_price!.calculated_amount!)[0];
      return { id: p.id, title: p.title, handle: p.handle, thumbnail: p.thumbnail, price: cheapest?.calculated_price?.calculated_amount ?? null };
    }),
    currencyCode: storefront.region.currency_code,
    count,
    offset,
  };
}

export function meta() {
  return [{ title: "Shop" }];
}

export default function Shop() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const loading = navigation.state === "loading";

  if (!data.ready) {
    return (
      <main className="storefront-page"><ShopNavigation />
        <h1>Shop</h1>
        <p role="status">This store isn't set up for browsing yet: {data.message}</p>
      </main>
    );
  }

  const hasNext = data.offset + PAGE_SIZE < data.count;
  const hasPrev = data.offset > 0;

  return (
    <main className="storefront-page" aria-busy={loading}><ShopNavigation />
      <h1>Shop</h1>
      <Form method="get" className="filter-bar"><div className="field"><label htmlFor="shop-search">Find a product</label><input className="input" id="shop-search" name="q" defaultValue={data.q} placeholder="Search products…" /></div><button className="btn" disabled={loading}>Search</button></Form>
      {data.products.length === 0 ? (
        <p>No products are available right now.</p>
      ) : (
        <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", listStyle: "none", padding: 0 }}>
          {data.products.map((product) => (
            <li key={product.id}>
              <Link to={product.handle ? `/products/${product.handle}` : "#"}>
                {product.thumbnail ? (
                  <img src={product.thumbnail} alt={product.title} style={{ width: "100%", height: "auto" }} />
                ) : null}
                <div>{product.title}</div>
                <div>{formatMoney(product.price, data.currencyCode)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Pagination" style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        {hasPrev ? (
          <Link to={`/shop?q=${encodeURIComponent(data.q)}&offset=${Math.max(0, data.offset - PAGE_SIZE)}`}>Previous</Link>
        ) : (
          <span aria-disabled="true">Previous</span>
        )}
        {hasNext ? <Link to={`/shop?q=${encodeURIComponent(data.q)}&offset=${data.offset + PAGE_SIZE}`}>Next</Link> : <span aria-disabled="true">Next</span>}
      </nav>
    </main>
  );
}
