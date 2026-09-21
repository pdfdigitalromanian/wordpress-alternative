import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { bufferToPgBytea, decryptSecret, encryptSecret, maskSecret, pgByteaToBuffer } from "~/lib/secrets.server";
import { testMedusaConnection, listStoreRegions, type StoreRegion } from "~/lib/medusa.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/store";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/lib/database.types";

function aadFor(siteId: string) {
  return `commerce_connection:${siteId}`;
}

async function loadDecryptedSecretKey(
  supabase: SupabaseClient<Database>,
  siteId: string,
): Promise<{ backendUrl: string; secretKey: string } | { error: string }> {
  const { data: connection, error } = await supabase
    .from("commerce_connections")
    .select("backend_url, encrypted_secret_key, secret_key_nonce, secret_key_tag")
    .eq("site_id", siteId)
    .single();
  if (error || !connection) return { error: "No connection saved yet." };

  try {
    const secretKey = decryptSecret(
      {
        ciphertext: pgByteaToBuffer(connection.encrypted_secret_key as unknown as string),
        nonce: pgByteaToBuffer(connection.secret_key_nonce as unknown as string),
        tag: pgByteaToBuffer(connection.secret_key_tag as unknown as string),
      },
      aadFor(siteId),
    );
    return { backendUrl: connection.backend_url, secretKey };
  } catch {
    return { error: "Stored key could not be decrypted — re-enter it." };
  }
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const siteId = params.siteId!;

  const { data: site, error: siteError } = await supabase.from("sites").select("id, name").eq("id", siteId).single();
  if (siteError || !site) throw new Response("Site not found", { status: 404 });

  const { data: connection, error: connectionError } = await supabase
    .from("commerce_connections")
    .select("id, backend_url, publishable_key, status, last_checked_at, last_error, default_region_id")
    .eq("site_id", siteId)
    .maybeSingle();
  if (connectionError) throw new Response(connectionError.message, { status: 500 });

  // Never send the encrypted bytes to the client — this loader never
  // selects them into `connection` above. A masked display value is
  // computed via a fresh, separate decrypt, and only the mask leaves
  // this function.
  let maskedKey: string | null = null;
  let regions: StoreRegion[] = [];
  if (connection) {
    const decrypted = await loadDecryptedSecretKey(supabase, siteId);
    maskedKey = "error" in decrypted ? "(unreadable — re-enter the key)" : maskSecret(decrypted.secretKey);

    if (connection.status === "connected" && connection.publishable_key) {
      regions = await listStoreRegions(connection.backend_url, connection.publishable_key).catch(() => []);
    }
  }

  return { site, connection, maskedKey, regions };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const siteId = params.siteId!;
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "save-connection") {
    const backendUrl = String(formData.get("backend_url") ?? "").trim();
    const secretKey = String(formData.get("secret_key") ?? "").trim();
    const publishableKey = String(formData.get("publishable_key") ?? "").trim() || null;

    if (!backendUrl || !secretKey) return { intent, error: "Backend URL and secret key are required." };

    const encrypted = encryptSecret(secretKey, aadFor(siteId));

    const { error } = await supabase.from("commerce_connections").upsert(
      {
        site_id: siteId,
        backend_url: backendUrl,
        encrypted_secret_key: bufferToPgBytea(encrypted.ciphertext),
        secret_key_nonce: bufferToPgBytea(encrypted.nonce),
        secret_key_tag: bufferToPgBytea(encrypted.tag),
        publishable_key: publishableKey,
        status: "unverified",
        created_by: user.id,
      } as never,
      { onConflict: "site_id" },
    );

    if (error) return { intent, error: error.message };
    return { intent, success: true };
  }

  if (intent === "test-connection") {
    const decrypted = await loadDecryptedSecretKey(supabase, siteId);
    if ("error" in decrypted) return { intent, error: decrypted.error };

    const result = await testMedusaConnection(decrypted.backendUrl, decrypted.secretKey);

    await supabase
      .from("commerce_connections")
      .update({
        status: result.ok ? "connected" : "error",
        last_checked_at: new Date().toISOString(),
        last_error: result.ok ? null : result.message,
      })
      .eq("site_id", siteId);

    if (!result.ok) return { intent, error: `Connection failed: ${result.message}` };
    return { intent, success: true };
  }

  if (intent === "save-region") {
    const regionId = String(formData.get("region_id") ?? "") || null;
    // RLS on commerce_connections (owner/administrator only) is the real
    // permission check here — this update simply goes through the same
    // user-scoped client every other write in this route uses.
    const { error } = await supabase.from("commerce_connections").update({ default_region_id: regionId }).eq("site_id", siteId);
    if (error) return { intent, error: error.message };
    return { intent, success: true };
  }

  if (intent === "delete-connection") {
    const { error } = await supabase.from("commerce_connections").delete().eq("site_id", siteId);
    if (error) return { intent, error: error.message };
    return { intent, success: true };
  }

  return { intent, error: "Unknown action." };
}

export default function StoreSetup() {
  const { site, connection, maskedKey, regions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <main>
      <p className="mb-2 text-sm">
        <Link to={`/admin/sites/${site.id}`} className="text-gray-600 hover:underline dark:text-gray-400">
          ← {site.name}
        </Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">Store</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Commerce is optional per site (Part B SS15) and backed by an isolated Medusa installation — one
        per commerce-enabled site, not a shared multi-tenant backend.
      </p>

      <section className="card">
        <h2 className="mb-3 text-lg font-medium">Connection</h2>

        {connection ? (
          <>
            <dl className="mb-4 space-y-1 text-sm">
              <div>
                <strong>Backend URL:</strong> {connection.backend_url}
              </div>
              <div>
                <strong>Secret key:</strong> <code>{maskedKey}</code>
              </div>
              <div>
                <strong>Publishable key:</strong> {connection.publishable_key || "(none set)"}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                {connection.status === "connected" ? (
                  <span className="text-green-700 dark:text-green-400">connected</span>
                ) : connection.status === "error" ? (
                  <span className="text-red-700 dark:text-red-400">error</span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">unverified</span>
                )}
              </div>
              {connection.last_checked_at ? (
                <div>
                  <strong>Last checked:</strong> {new Date(connection.last_checked_at).toLocaleString()}
                </div>
              ) : null}
              {connection.last_error ? (
                <div className="text-red-700 dark:text-red-400">
                  <strong>Last error:</strong> {connection.last_error}
                </div>
              ) : null}
            </dl>

            <div className="flex gap-2">
              <Form method="post">
                <input type="hidden" name="intent" value="test-connection" />
                <button type="submit" disabled={submitting} className="btn">
                  Test connection
                </button>
              </Form>
              {connection.status === "connected" ? (
                <Link to={`/admin/sites/${site.id}/store/products`} className="btn-secondary">
                  View products
                </Link>
              ) : null}
              {/* Native Medusa Admin — a separate app with its OWN
                  authentication (Part B SS4/work-order item 4). Not SSO:
                  Supabase login here does not log you into it. */}
              <a
                href={`${connection.backend_url.replace(/\/$/, "")}/app`}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-secondary"
              >
                Open Medusa Admin ↗
              </a>
              <Form method="post">
                <input type="hidden" name="intent" value="delete-connection" />
                <button type="submit" disabled={submitting} className="btn-secondary">
                  Remove connection
                </button>
              </Form>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Products, inventory, orders, customers, promotions and fulfillment are managed in Medusa Admin for now
              (Part B §19) — sign in there separately; this link does not carry your CMS session.
            </p>
          </>
        ) : (
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">No connection configured yet.</p>
        )}
      </section>

      {connection?.status === "connected" && regions.length > 0 ? (
        <section className="card">
          <h2 className="mb-3 text-lg font-medium">Default region</h2>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
            A single-region default is enough for this milestone (multi-region selection per product/cart is a later
            refinement). Storefront prices, currency and available countries all follow this region.
          </p>
          <Form method="post" className="flex items-end gap-2">
            <input type="hidden" name="intent" value="save-region" />
            <div className="field mb-0 flex-1">
              <label htmlFor="region_id">Region</label>
              <select id="region_id" name="region_id" className="input" defaultValue={connection.default_region_id ?? ""}>
                <option value="">(none — use the backend's first region)</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name} ({region.currency_code.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={submitting} className="btn">
              Save
            </button>
          </Form>
        </section>
      ) : null}

      <section className="card">
        <h2 className="mb-3 text-lg font-medium">{connection ? "Replace connection" : "Add connection"}</h2>
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="save-connection" />
          <div className="field">
            <label htmlFor="backend_url">Backend URL</label>
            <input
              id="backend_url"
              name="backend_url"
              type="text"
              required
              className="input"
              placeholder="http://localhost:9000"
              defaultValue={connection?.backend_url ?? "http://localhost:9000"}
            />
          </div>
          <div className="field">
            <label htmlFor="secret_key">
              Secret API key (Medusa Admin → Settings → API Key Management → Secret keys)
            </label>
            <input id="secret_key" name="secret_key" type="password" required className="input" placeholder="sk_..." />
          </div>
          <div className="field">
            <label htmlFor="publishable_key">Publishable key (optional, for the storefront)</label>
            <input
              id="publishable_key"
              name="publishable_key"
              type="text"
              className="input"
              placeholder="pk_..."
              defaultValue={connection?.publishable_key ?? ""}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn">
            Save connection
          </button>
        </Form>
      </section>

      {actionData && "error" in actionData ? <p className="alert-error">{actionData.error}</p> : null}
      {actionData && "success" in actionData ? <p className="alert-success">Done.</p> : null}
    </main>
  );
}
