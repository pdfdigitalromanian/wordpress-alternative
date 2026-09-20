// SSRF-guard regression tests for medusa.server.ts's resolveSafeTarget
// (exercised indirectly through testMedusaConnection, which validates
// the backend URL before making any network call — so these run without
// a live Medusa instance for every case except the two that need one to
// confirm the "happy path" still actually works end to end).
//
// Run: node --experimental-strip-types --test app/lib/medusa.server.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { testMedusaConnection } from "./medusa.server.ts";

const DUMMY_KEY = "sk_test_dummy_not_a_real_key";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) previous[key] = process.env[key];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("localhost is allowed in development without an allowlist", async () => {
  const result = await withEnv({ NODE_ENV: "development", COMMERCE_ALLOWED_BACKEND_ORIGINS: undefined }, () =>
    testMedusaConnection("http://localhost:9000", DUMMY_KEY),
  );
  // Reaches the network step (may fail auth against a real/no instance,
  // but must NOT fail with an SSRF-guard message).
  assert.notEqual(result.ok, undefined);
  if (!result.ok) assert.doesNotMatch(result.message, /^Backend (URL|hostname)/);
});

test("localhost is rejected in production without an allowlist", async () => {
  const result = await withEnv({ NODE_ENV: "production", COMMERCE_ALLOWED_BACKEND_ORIGINS: undefined }, () =>
    testMedusaConnection("http://localhost:9000", DUMMY_KEY),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /https/i);
});

test("localhost is allowed in production when explicitly allowlisted", async () => {
  const result = await withEnv(
    { NODE_ENV: "production", COMMERCE_ALLOWED_BACKEND_ORIGINS: "http://localhost:9000" },
    () => testMedusaConnection("http://localhost:9000", DUMMY_KEY),
  );
  // Passes the SSRF guard either way; only a live-instance auth failure
  // (not an SSRF rejection) is acceptable here.
  if (!result.ok) assert.doesNotMatch(result.message, /^Backend (URL|hostname)/);
});

test("a private non-localhost IP is rejected even in development", async () => {
  const result = await withEnv({ NODE_ENV: "development", COMMERCE_ALLOWED_BACKEND_ORIGINS: undefined }, () =>
    testMedusaConnection("http://192.168.1.1:9000", DUMMY_KEY),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /https/i);
});

test("a private IP is rejected even over https", async () => {
  const result = await withEnv({ NODE_ENV: "development", COMMERCE_ALLOWED_BACKEND_ORIGINS: undefined }, () =>
    testMedusaConnection("https://192.168.1.1:9000", DUMMY_KEY),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /private|loopback|link-local/i);
});

test("a URL with embedded credentials is rejected", async () => {
  const result = await withEnv({ NODE_ENV: "development" }, () =>
    testMedusaConnection("http://user:pass@localhost:9000", DUMMY_KEY),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /credentials/i);
});

test("a malformed URL is rejected with a clear message, not a crash", async () => {
  const result = await withEnv({ NODE_ENV: "development" }, () => testMedusaConnection("not a url", DUMMY_KEY));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /not a valid url/i);
});

test("an explicit allowlist entry allows a private IP that would otherwise be rejected", async () => {
  const result = await withEnv(
    { NODE_ENV: "development", COMMERCE_ALLOWED_BACKEND_ORIGINS: "http://192.168.1.1:9000" },
    () => testMedusaConnection("http://192.168.1.1:9000", DUMMY_KEY),
  );
  // Passes the SSRF guard (allowlisted); only a network-level failure
  // (nothing is actually listening there) is acceptable.
  if (!result.ok) assert.doesNotMatch(result.message, /^Backend (URL|hostname)/);
});

// --- End-to-end happy path against the real local instance, so the
// regression suite above isn't the only thing standing between "the
// guard compiles" and "the guard actually lets real traffic through". ---

test("end-to-end: a real local Medusa instance is reachable through the guard", async () => {
  const result = await withEnv({ NODE_ENV: "development", COMMERCE_ALLOWED_BACKEND_ORIGINS: undefined }, () =>
    testMedusaConnection("http://localhost:9000", process.env.MEDUSA_TEST_SECRET_KEY ?? DUMMY_KEY),
  );
  if (!process.env.MEDUSA_TEST_SECRET_KEY) {
    console.log("  (skipped assertion on result.ok — set MEDUSA_TEST_SECRET_KEY to a real key to check auth too)");
    return;
  }
  assert.equal(result.ok, true);
});
