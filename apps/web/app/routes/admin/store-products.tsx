import { useState } from "react";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { decryptSecret, pgByteaToBuffer } from "~/lib/secrets.server";
import { createMedusaProductDraft, listMedusaProducts } from "~/lib/medusa.server";
import { siteAccess } from "~/lib/site-access.server";
import { Dialog } from "~/components/dialog";
import type { Route } from "./+types/store-products";

async function productAccess(request: Request, siteId: string) {
  const access = await siteAccess(request, siteId);
  if (!access.canManage) throw new Response("Store products require owner or administrator access.", { status: 403 });
  const { data: connection } = await access.supabase.from("commerce_connections").select("backend_url,encrypted_secret_key,secret_key_nonce,secret_key_tag,status").eq("site_id", siteId).maybeSingle();
  return { ...access, connection };
}
function secret(connection: NonNullable<Awaited<ReturnType<typeof productAccess>>["connection"]>, siteId: string) {
  return decryptSecret({ ciphertext: pgByteaToBuffer(connection.encrypted_secret_key as unknown as string), nonce: pgByteaToBuffer(connection.secret_key_nonce as unknown as string), tag: pgByteaToBuffer(connection.secret_key_tag as unknown as string) }, `commerce_connection:${siteId}`);
}
export async function loader({ request, params }: Route.LoaderArgs) {
  const { site, connection } = await productAccess(request, params.siteId);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").slice(0, 200);
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0);
  const adminUrl = connection ? `${connection.backend_url.replace(/\/$/, "")}/app` : null;
  const base = { site, adminUrl, q, offset };
  if (!connection) return { ...base, products: [], count: 0, error: "Connect a Medusa store to manage products.", ready: false };
  try {
    const result = await listMedusaProducts(connection.backend_url, secret(connection, site.id), { limit: 20, offset, q });
    return { ...base, ...result, error: null, ready: true };
  } catch { return { ...base, products: [], count: 0, error: "The product catalog is unavailable. Check your store connection and retry.", ready: false }; }
}
export async function action({ request, params }: Route.ActionArgs) {
  const { site, connection } = await productAccess(request, params.siteId);
  if (!connection) return { error: "Connect a store before adding products." };
  const form = await request.formData();
  const title = String(form.get("title") || "").trim();
  const handle = String(form.get("handle") || "").trim();
  const description = String(form.get("description") || "").trim();
  const thumbnail = String(form.get("thumbnail") || "").trim();
  if (!title || title.length > 200) return { error: "Enter a title between 1 and 200 characters." };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(handle) || handle.length > 200) return { error: "Use lowercase letters, numbers, and hyphens for the product path." };
  if (description.length > 10000) return { error: "Keep the description below 10,000 characters." };
  if (thumbnail && !/^https:\/\//i.test(thumbnail)) return { error: "Use an HTTPS image URL or leave it blank." };
  try {
    const { product } = await createMedusaProductDraft(connection.backend_url, secret(connection, site.id), { title, handle, description, ...(thumbnail ? { thumbnail } : {}) });
    return { success: `“${product.title}” was created as a draft.`, productId: product.id };
  } catch { return { error: "Creation could not be confirmed. Refresh the product list before retrying to avoid duplicates. Check the path is unique and the store is connected." }; }
}
export default function StoreProducts() {
  const { site, products, count, adminUrl, error, ready, q, offset } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  const [open, setOpen] = useState(false);
  const [resultAtOpen, setResultAtOpen] = useState<typeof result>();
  const dialogResult = result !== resultAtOpen ? result : undefined;
  const base = `/admin/sites/${site.id}/store`;
  return <main><div className="page-heading"><div><span className="eyebrow">STORE</span><h1>Products</h1><p className="muted">Your real catalog, connected to Medusa.</p></div><div className="heading-actions"><Link className="btn-secondary" to={base}>Store settings</Link><button className="btn" disabled={!ready} onClick={() => { setResultAtOpen(result); setOpen(true); }}>＋ Add product</button></div></div>
    <div className="notice-banner"><div><strong>Products and pages have separate publishing.</strong><p>Create a draft here, then set variants, prices, inventory, and sales channels in Medusa Admin. Only available products appear in the shop and product picker.</p></div>{adminUrl ? <a className="btn-secondary" href={`${adminUrl}/products`} target="_blank" rel="noreferrer">Manage catalog ↗</a> : null}</div>
    {error ? <div className="alert-error" role="alert">{error} <Link className="text-link" to={base}>Open store setup</Link></div> : null}
    {result && "success" in result ? <p role="status" className="alert-success">{result.success} <a className="text-link" href={`${adminUrl}/products/${result.productId}`} target="_blank" rel="noreferrer">Set price & variants ↗</a></p> : null}
    <Form method="get" className="filter-bar"><div className="field"><label htmlFor="q">Search products</label><input id="q" name="q" defaultValue={q} className="input" placeholder="Search your catalog…" /></div><button className="btn-secondary">Search</button>{ready ? <span className="muted">{count} products</span> : null}</Form>
    <section className="card"><ul className="page-manager-list">{products.map(product => <li key={product.id}>{product.thumbnail ? <img className="product-thumbnail" src={product.thumbnail} alt="" /> : <span className="product-thumbnail product-placeholder" aria-hidden="true">▧</span>}<div><strong>{product.title}</strong><small>/products/{product.handle || "Not set"}</small></div><span className={`badge ${product.status === "published" ? "badge-green" : "badge-amber"}`}>{product.status}</span><a className="btn-secondary" href={`${adminUrl}/products/${product.id}`} target="_blank" rel="noreferrer">Edit product ↗</a></li>)}</ul>{ready && !products.length ? <div className="empty-state"><h2>{q ? "No matching products" : "Your first product belongs here"}</h2><p>{q ? "Try a different search." : "Add a product draft, then finish its pricing and availability in Medusa."}</p></div> : null}</section>
    <nav className="pagination" aria-label="Product pages">{offset > 0 ? <Link className="btn-secondary" to={`?q=${encodeURIComponent(q)}&offset=${Math.max(0, offset - 20)}`}>← Previous</Link> : null}{offset + 20 < count ? <Link className="btn-secondary" to={`?q=${encodeURIComponent(q)}&offset=${offset + 20}`}>Next →</Link> : null}</nav>
    {open ? <Dialog title="Add a product" onClose={() => setOpen(false)}><p className="muted section-copy">Create a draft in your connected store. Finish pricing, variants, shipping, and publication in Medusa Admin.</p><Form method="post"><div className="field"><label htmlFor="product-title">Product name</label><input id="product-title" name="title" required maxLength={200} className="input" autoFocus /></div><div className="field"><label htmlFor="handle">Product path</label><input id="handle" name="handle" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input" placeholder="linen-shirt" /></div><div className="field"><label htmlFor="description">Description</label><textarea id="description" name="description" maxLength={10000} rows={4} className="input" /></div><div className="field"><label htmlFor="thumbnail">Image URL (optional)</label><input id="thumbnail" name="thumbnail" type="url" className="input" placeholder="https://…" /></div>{dialogResult && "error" in dialogResult ? <p role="alert" className="alert-error">{dialogResult.error}</p> : null}{dialogResult && "success" in dialogResult ? <p className="alert-success" role="status">{dialogResult.success} <a href={`${adminUrl}/products/${dialogResult.productId}`} className="text-link" target="_blank" rel="noreferrer">Finish product setup ↗</a></p> : null}<div className="dialog-actions"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Close</button><button disabled={busy || Boolean(dialogResult && "success" in dialogResult)} className="btn">{busy ? "Creating…" : "Create product draft"}</button></div></Form></Dialog> : null}
  </main>;
}
