import { Link, useLoaderData } from "react-router";
import { decryptSecret, pgByteaToBuffer } from "~/lib/secrets.server";
import { listMedusaProducts } from "~/lib/medusa.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/store-products";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const siteId = params.siteId!;

  const { data: site, error: siteError } = await supabase.from("sites").select("id, name").eq("id", siteId).single();
  if (siteError || !site) throw new Response("Site not found", { status: 404 });

  const { data: connection, error: connectionError } = await supabase
    .from("commerce_connections")
    .select("backend_url, encrypted_secret_key, secret_key_nonce, secret_key_tag, status")
    .eq("site_id", siteId)
    .maybeSingle();
  if (connectionError) throw new Response(connectionError.message, { status: 500 });
  if (!connection) {
    throw new Response("No commerce connection configured for this site yet.", { status: 400 });
  }

  const secretKey = decryptSecret(
    {
      ciphertext: pgByteaToBuffer(connection.encrypted_secret_key as unknown as string),
      nonce: pgByteaToBuffer(connection.secret_key_nonce as unknown as string),
      tag: pgByteaToBuffer(connection.secret_key_tag as unknown as string),
    },
    `commerce_connection:${siteId}`,
  );

  // listMedusaProducts only ever returns the allowlisted fields declared
  // in its own query (Part B SS20: strip unknown fields, allowlist
  // expansions) — nothing from Medusa's response reaches this loader's
  // return value except what that function explicitly selected.
  const { products, count } = await listMedusaProducts(connection.backend_url, secretKey, { limit: 50 });

  return { site, products, count };
}

export default function StoreProducts() {
  const { site, products, count } = useLoaderData<typeof loader>();

  return (
    <main>
      <p className="mb-2 text-sm">
        <Link to={`/admin/sites/${site.id}/store`} className="text-gray-600 hover:underline dark:text-gray-400">
          ← Store
        </Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">Products</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        {count} product{count === 1 ? "" : "s"} in this site's Medusa installation.
      </p>

      {products.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No products yet — add some in Medusa Admin.</p>
      ) : (
        <ul className="space-y-2">
          {products.map((product) => (
            <li key={product.id} className="card flex items-center gap-3">
              {product.thumbnail ? (
                <img src={product.thumbnail} alt="" width={48} height={48} className="rounded object-cover" />
              ) : null}
              <div>
                <div className="font-medium">{product.title}</div>
                <div className="text-sm text-gray-500">
                  {product.status} {product.handle ? `· /${product.handle}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
