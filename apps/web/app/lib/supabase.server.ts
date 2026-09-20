import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * A per-request, session-scoped client. Every query through this client
 * is subject to RLS as the signed-in user (or anon, if none) — this is
 * the only client application routes/loaders should use to read or write
 * CMS data. Returns any Set-Cookie headers that must be attached to the
 * outgoing Response (session refresh, sign-in, sign-out).
 */
export function createSupabaseServerClient(request: Request) {
  const headers = new Headers();

  const supabase = createServerClient<Database>(
    requireEnv("SUPABASE_URL"),
    requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "");
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            headers.append("Set-Cookie", serializeCookieHeader(name, value, options));
          }
        },
      },
    },
  );

  return { supabase, headers };
}

/**
 * A privileged client using the server-only secret key. Bypasses RLS
 * entirely — every call site using this client is responsible for
 * performing its own authorization check first (e.g. resolving a public
 * site by verified hostname, where there is no authenticated user to
 * scope RLS to). Never import this into anything that could end up in a
 * client bundle; it lives in a `.server.ts` file specifically so the
 * bundler excludes it from client output.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
