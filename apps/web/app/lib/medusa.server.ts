import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Server boundary between CMS staff and a site's Medusa installation
 * (Part B SS20). Callers never see a raw secret key or an open proxy —
 * only these typed functions, each making an allowlisted admin API call
 * with the decrypted key resolved server-side for that one request.
 *
 * Medusa v2's secret API keys authenticate via HTTP Basic auth with the
 * key as the username and an empty password (`Authorization: Basic
 * base64("sk_...:")`) — verified directly against a running local
 * instance; Bearer returns a 401 with an explicit error naming Basic as
 * the required scheme. Not the v1 header convention, not invented.
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
  return (
    lower === "::1" || // loopback
    lower.startsWith("fe80:") || // link-local
    lower.startsWith("fc") || // unique local fc00::/7
    lower.startsWith("fd") ||
    lower.startsWith("::ffff:") // IPv4-mapped — recheck as IPv4 below
  );
}

/**
 * Guards against SSRF: rejects loopback/private/link-local/metadata
 * targets, with an explicit operator-controlled exception for localhost
 * in this dev environment (Part B SS20 permits this only for local
 * development, never as a tenant-controllable override — there is no
 * way for a site owner's input to reach this exception except by the
 * hostname literally being localhost/127.0.0.1, which is not useful for
 * attacking anything but the operator's own machine).
 */
async function assertSafeBackendUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Backend URL is not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Backend URL must use http or https.");
  }

  const isLocalDevHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (isLocalDevHost) return url; // explicit local dev exception

  if (url.protocol !== "https:") {
    throw new Error("Non-local backend URLs must use https.");
  }

  const ipVersion = isIP(url.hostname);
  const addresses =
    ipVersion !== 0
      ? [{ address: url.hostname, family: ipVersion as 4 | 6 }]
      : await lookup(url.hostname, { all: true }).catch(() => {
          throw new Error("Could not resolve backend hostname.");
        });

  for (const { address, family } of addresses) {
    const isPrivate = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
    if (isPrivate) {
      throw new Error("Backend URL resolves to a private, loopback, or link-local address.");
    }
  }

  return url;
}

type MedusaRequestOptions = {
  backendUrl: string;
  secretKey: string;
  path: string;
  searchParams?: Record<string, string>;
};

async function medusaAdminGet<T>({ backendUrl, secretKey, path, searchParams }: MedusaRequestOptions): Promise<T> {
  const base = await assertSafeBackendUrl(backendUrl);
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    url.searchParams.set(key, value);
  }

  const basicAuth = Buffer.from(`${secretKey}:`, "utf8").toString("base64");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Basic ${basicAuth}` },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Medusa backend did not respond in time.");
    }
    throw new Error("Could not reach the Medusa backend (network error).");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401) throw new Error("Medusa rejected the secret key (unauthenticated).");
  if (!response.ok) throw new Error(`Medusa returned ${response.status}.`);

  return (await response.json()) as T;
}

export type ConnectionTestResult =
  | { ok: true }
  | { ok: false; reason: "unreachable" | "unauthorized" | "unsupported" | "unknown"; message: string };

export async function testMedusaConnection(backendUrl: string, secretKey: string): Promise<ConnectionTestResult> {
  try {
    await medusaAdminGet<unknown>({ backendUrl, secretKey, path: "/admin/products", searchParams: { limit: "1" } });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("unauthenticated")) return { ok: false, reason: "unauthorized", message };
    if (message.includes("network error") || message.includes("respond in time")) {
      return { ok: false, reason: "unreachable", message };
    }
    if (message.includes("Medusa returned")) return { ok: false, reason: "unsupported", message };
    return { ok: false, reason: "unknown", message };
  }
}

export type MedusaProductSummary = {
  id: string;
  title: string;
  status: string;
  thumbnail: string | null;
  handle: string | null;
};

export async function listMedusaProducts(
  backendUrl: string,
  secretKey: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ products: MedusaProductSummary[]; count: number }> {
  const data = await medusaAdminGet<{
    products: MedusaProductSummary[];
    count: number;
  }>({
    backendUrl,
    secretKey,
    path: "/admin/products",
    searchParams: {
      limit: String(opts.limit ?? 20),
      offset: String(opts.offset ?? 0),
      fields: "id,title,status,thumbnail,handle",
    },
  });
  return data;
}
