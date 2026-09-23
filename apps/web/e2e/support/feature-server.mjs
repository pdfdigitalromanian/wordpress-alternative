// Fully local service doubles. This fixture never reads .env files or reaches
// hosted Supabase/Medusa; it exercises the built app's real loaders/actions.
import { createServer } from "node:http";
import { createCipheriv, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
const apiPort = 5188;
const appPort = 5189;
const api = `http://127.0.0.1:${apiPort}`;
const siteId = "11111111-1111-4111-8111-111111111111";
const user = { id: "22222222-2222-4222-8222-222222222222", email: "owner@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const key = Buffer.alloc(32, 7);
const nonce = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, nonce);
cipher.setAAD(Buffer.from(`commerce_connection:${siteId}`));
const encrypted = Buffer.concat([cipher.update("fixture-secret"), cipher.final()]);
const blank = () => ({ content: [], root: { props: { content: [] } } });
let tables, role, productWrites, saveFailure;
function reset() {
  role = "owner"; productWrites = []; saveFailure = false;
  tables = {
    sites: [{ id: siteId, name: "Feature test site", slug: "feature-test", workspace_id: "workspace-1", active_release_id: null }],
    pages: [{ id: "home-page", site_id: siteId, title: "Home", slug: "", draft_document: blank(), draft_updated_at: "2026-01-01T00:00:00.000Z", created_at: "2026-01-01T00:00:00.000Z" }],
    releases: [], release_pages: [], site_domains: [{ site_id: siteId, hostname: "localhost", verified_at: "2026-01-01", is_primary: true }],
    public_site_by_hostname: [{ hostname: "localhost", site_id: siteId }],
    commerce_connections: [{ id: "connection", site_id: siteId, backend_url: api, encrypted_secret_key: `\\x${encrypted.toString("hex")}`, secret_key_nonce: `\\x${nonce.toString("hex")}`, secret_key_tag: `\\x${cipher.getAuthTag().toString("hex")}`, publishable_key: "fixture-publishable", status: "connected", default_region_id: "region", last_checked_at: "2026-01-01", last_error: null }],
    products: [{ id: "product-shirt", title: "Linen shirt", status: "published", handle: "linen-shirt", thumbnail: null, variants: [{ id: "variant", title: "Standard", calculated_price: { calculated_amount: 49, currency_code: "eur" } }] }],
  };
}
reset();
const server = createServer(async (req, res) => {
  let raw = ""; for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url, api);
  const json = (value, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
  if (url.pathname === "/__test/reset") { reset(); return json({ ok: true }); }
  if (url.pathname === "/__test/state") return json({ tables, productWrites });
  if (url.pathname === "/__test/role") { role = body.role; return json({ ok: true }); }
  if (url.pathname === "/__test/save-failure") { saveFailure = body.enabled; return json({ ok: true }); }
  if (url.pathname === "/auth/v1/token") {
    const encode = obj => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role, exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`;
    return json({ access_token: token, token_type: "bearer", expires_in: 3600, refresh_token: "fixture-refresh", user });
  }
  if (url.pathname === "/auth/v1/user") return json(user);
  if (url.pathname === "/auth/v1/logout") return json({});
  if (url.pathname === "/rest/v1/rpc/workspace_role_of") return json(role);
  if (url.pathname === "/rest/v1/rpc/publish_site") {
    const release = { id: randomUUID(), site_id: siteId, label: body.release_label, created_at: new Date().toISOString() };
    tables.releases.unshift(release);
    tables.release_pages.push(...tables.pages.map(page => ({ id: randomUUID(), page_id: page.id, release_id: release.id, title: page.title, slug: page.slug, document: structuredClone(page.draft_document) })));
    tables.sites[0].active_release_id = release.id; return json(release);
  }
  if (url.pathname === "/rest/v1/rpc/rollback_site") { tables.sites[0].active_release_id = body.target_release_id; return json(null); }
  if (url.pathname === "/store/regions") return json({ regions: [{ id: "region", name: "Europe", currency_code: "eur", countries: [{ iso_2: "ro", display_name: "Romania" }] }] });
  if (url.pathname === "/admin/products" || url.pathname === "/store/products") {
    if (req.method === "POST") { productWrites.push(body); const product = { id: randomUUID(), ...body, thumbnail: body.thumbnail || null, variants: [] }; tables.products.push(product); return json({ product }); }
    let products = tables.products.filter(p => (!url.searchParams.get("q") || p.title.toLowerCase().includes(url.searchParams.get("q").toLowerCase())) && (!url.searchParams.get("id") || p.id === url.searchParams.get("id")) && (url.pathname.startsWith("/admin") || p.status === "published"));
    const count = products.length; const offset = Number(url.searchParams.get("offset") || 0);
    return json({ products: products.slice(offset, offset + Number(url.searchParams.get("limit") || 20)), count });
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    const name = url.pathname.split("/").pop();
    if (name === "workspaces") return json([{ id: "workspace-1", name: "Test workspace", slug: "test", sites: tables.sites.map(site => ({ ...site, site_domains: tables.site_domains })) }]);
    if (!tables[name]) return json([]);
    const matches = row => [...url.searchParams.entries()].every(([key, value]) => !value.startsWith("eq.") || String(row[key]) === value.slice(3));
    let rows = tables[name].filter(matches);
    if (req.method === "POST") {
      if (name === "pages" && tables.pages.some(page => page.site_id === body.site_id && page.slug === body.slug)) return json({ code: "23505", message: "duplicate path" }, 409);
      const row = { id: randomUUID(), created_at: new Date().toISOString(), draft_updated_at: new Date().toISOString(), ...body }; tables[name].push(row); rows = [row];
    }
    if (req.method === "PATCH") { if (name === "pages" && saveFailure) return json({ message: "Simulated save failure" }, 503); rows.forEach(row => Object.assign(row, body)); }
    if (req.method === "DELETE") { tables[name] = tables[name].filter(row => !rows.includes(row)); }
    if (url.searchParams.get("limit")) rows = rows.slice(0, Number(url.searchParams.get("limit")));
    if (req.headers.accept?.includes("vnd.pgrst.object")) return rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "not found" }, 406);
    return json(rows);
  }
  json({ message: `Unhandled fixture route ${url.pathname}` }, 404);
});
server.listen(apiPort, "127.0.0.1", () => {
  const app = spawn(process.execPath, ["node_modules/@react-router/serve/bin.cjs", "build/server/nodejs_eyJydW50aW1lIjoibm9kZWpzIn0/index.js"], {
    stdio: "inherit",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", PORT: String(appPort), SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: "fixture-anon", SUPABASE_SECRET_KEY: "fixture-server", INTEGRATION_ENCRYPTION_KEY: key.toString("hex"), SESSION_SECRET: "fixture-session-key-only-for-local-tests", COMMERCE_ALLOWED_BACKEND_ORIGINS: api },
  });
  const close = () => { app.kill(); server.close(); };
  process.on("SIGTERM", close); process.on("SIGINT", close);
});
