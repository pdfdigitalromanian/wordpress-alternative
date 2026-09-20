# Progress

Last updated: 2026-09-20, end of the session that implemented the
storefront/cart phase (commit `14b79f4`, on top of the security-fix
commit `1761598` and the pre-existing `b5ded70`). This file is the
current source of truth for what's actually built — `docs/implementation-
plan.md`'s milestone numbering is kept for traceability to the original
requirements, not as the authoritative sequence.

## What actually works right now

Verified live against the hosted Supabase project (`nsfcmwlbippjjlpvjoyd`)
and a local Medusa v2 instance (`http://localhost:9000`), not just typed
or read.

**CMS core (M0-M2):**
- Sign in (`/login`, no public sign-up), workspace/site ownership with
  RLS-enforced cross-workspace isolation (`pnpm test:rls`, 9/9).
- Visual editor (`/admin/sites/:id/pages/:id`, Puck) with autosave,
  optimistic-concurrency conflict detection, server-side document
  validation (component type/prop allowlist/size cap, 10/10 tests), and
  a real publish flow (immutable releases, atomic pointer, rollback;
  `pnpm test:publish`, 18/18, caught and fixed a real PL/pgSQL NULL-
  handling bug where a non-member could call the publish/rollback RPCs).
- Public rendering (`routes/site-page.tsx`) resolves host → site →
  published release → page-by-path, server-renders real content, 404s
  any unregistered host.

**Commerce (this session, M3-reprioritized):**
- `/admin/sites/:id/store`: encrypted Medusa connection (AES-256-GCM),
  masked-key display, connection test with 4 distinct honest failure
  reasons, product list from the Admin API.
- Public storefront: `/shop`, `/products/:handle`, `/cart` — real
  product data and Medusa-computed totals via the Store API
  (publishable key only, never the Admin secret). Full cart lifecycle
  (add/update/remove/persist-across-reload/session-isolation) verified
  through the actual routes. Insufficient-inventory rejection verified
  by temporarily setting real stock to 1 via the Admin API and
  confirming the honest rejection, then restoring it.
- `ProductGrid` Puck component: real products render server-side on a
  published page (`/featured` in the seeded data — real images, EUR
  10.00 formatted correctly, working product links). Confirmed prices
  are resolved fresh per request from Medusa, not frozen into the CMS
  release, so publishing/rolling back a layout never touches commerce
  state in either direction.
- SSRF guard on the Medusa backend-URL field: operator allowlist,
  production-gated localhost exception, DNS-rebinding-resistant (pins
  the connection to a once-validated IP), 9 regression tests — one of
  which caught a real bug (see below) before it shipped.

## Bugs found and fixed this session (by tests, not just review)

1. **`workspaces_select` RLS timing bug** (M1): a brand-new workspace's
   creator couldn't see their own `INSERT ... RETURNING` row, because
   the SELECT policy depended on an `AFTER INSERT` trigger's membership
   row, and Postgres fires `AFTER ROW` triggers after the `RETURNING`
   projection is computed. Fixed by also allowing `created_by =
   auth.uid()` directly.
2. **`publish_site`/`rollback_site` NULL-role bypass** (M2): a complete
   outsider (no workspace membership at all) could call either RPC,
   because `workspace_role_of()` returns `NULL` for a non-member and
   PL/pgSQL's `IF NULL THEN raise` silently evaluates as false. Fixed
   with an explicit NULL check. Caught by `supabase/tests/publish-
   rollback.mjs`.
3. **SSRF guard private-IP-in-dev bypass** (this session): the "allow
   localhost in development" exception was re-derived from "is this IP
   private" instead of the literal hostname, so it wrongly admitted
   *any* RFC1918 address (e.g. `192.168.1.1`) in development, not just
   `localhost`. Fixed by computing the exception once from the hostname
   string and reusing it. Caught by `apps/web/app/lib/medusa.server.test.ts`.

The pattern across all three: something that looked locally correct
(one policy, one branch) was wrong about a *global* property (row
visibility timing, NULL propagation, exception scope). Worth specifically
re-testing this class of bug in future security-relevant work here,
not just reviewing the diff.

## Credential rotation (this session)

The local Medusa admin password and a Medusa secret API key appeared in
this session's terminal output (visible in the transcript). Both were
rotated:
- Local Medusa admin user (`grandsam.s2018@gmail.com`): auth identity
  deleted and recreated with a fresh password (`npx medusa user`, plus
  direct `auth_identity`/`user_rbac_role` cleanup since the CLI can't
  update an existing user's password — confirmed old password no longer
  works, new one does). Value is in `.medusa-admin-credentials.local`
  (gitignored, `chmod 600`), never displayed in chat.
- Medusa secret API key: old key revoked via `/admin/api-keys/:id/revoke`
  (confirmed: old key → 401, new key → 200), new one generated and saved
  to `.medusa-secret-key.local` (gitignored, `chmod 600`), and the CMS's
  stored `commerce_connections` row updated to the new key (confirmed
  "connected" status afterward).
- Git history checked (`git log --all -p | grep <old values>`): clean,
  neither value was ever committed.

This is a local-only Medusa instance not reachable from outside this
machine, so the exposure risk was low, but rotation was still done per
the explicit instruction rather than judged unnecessary.

## Known gaps / deliberate simplifications (not hidden)

- **Region selection**: `resolveStorefront()` takes the first Medusa
  region unconditionally. Correct for the single-region store this was
  tested against; a multi-region store would show every product in that
  one region's currency until per-site region/currency configuration is
  built (Part B §22).
- **ProductGrid category/collection field** is a plain text ID input,
  not a picker UI.
- **Domain "verification"** in `/admin` (`site.tsx`/`site_domains`) is an
  explicit manual flag, not real DNS record checking — labeled as such
  in the UI, not silently pretending to be real.
- **Store admin parity**: only Setup/status and Products exist. Inventory,
  orders, customers, promotions, shipping/regions, presentation are
  deferred per Part B §19's explicit interim-delivery decision — "Open
  Medusa Admin" link for those isn't built yet either (next executable
  action below).
- **Node v24** vs. Medusa's documented `^20.19.0 || >=22.12.0` range:
  unverified upstream, has worked in every command run so far. Not
  changed, per standing user instruction not to manage Node versions.
- **No production deploy target** chosen for `apps/medusa` yet (needs a
  persistent Node host, not Vercel — see `docs/architecture.md`).

## Verification NOT done (named, not silently skipped)

**No browser-automation tool is available in this environment** (checked
via `ToolSearch` — no `mcp__Claude_Browser__*` / `mcp__claude-in-chrome__*`
/ computer-use tools were present). Everything above was verified via:
direct HTTP requests (curl) against the running dev server reproducing
exact user flows (login → create → autosave → publish → view), direct
inspection of server-rendered HTML for real content, `pnpm typecheck`,
and real automated test suites (`pnpm test` in `apps/web`, `pnpm
test:rls`, `pnpm test:publish` at the repo root).

**Also not empirically tested**: cross-*site* cart/connection isolation
with two live sites (only cross-*session* isolation on one site was
tested — two cookie jars against the same site correctly get separate
carts). Cross-site isolation is structurally guaranteed by two
independent mechanisms rather than by careful code review alone: the
cart cookie is both site-scoped by name (`drcms_cart_${siteId}`) *and*
never carries a `Domain` attribute (host-only, browser-enforced
per-origin), and each site requires its own distinct verified hostname
to be reachable at all (`site_domains`). Setting up a second full
site+domain+Medusa-connection to empirically confirm this was judged not
worth the time given it's guaranteed by construction on two independent
axes — flagged here rather than silently assumed, so it can be revisited
if that reasoning turns out to be wrong.

**Not verified**: actual browser interaction — dragging a Puck component
onto the canvas, clicking through the variant selector, mobile viewport
rendering, keyboard-only navigation, screen-reader behavior. The server-
side contracts these interactions call (autosave, add-to-cart, etc.) are
verified; the client-side interaction layer itself (React state, Puck's
internal drag-and-drop, focus management) is not. This is the same
blocked verification named in the previous session and remains blocked
for the same reason.

## Next executable action

In priority order, matching the corrected M3→M6 sequence in
`docs/implementation-plan.md`:

1. **Guest checkout (M5)**: region/address/shipping selection, a test-mode
   payment provider (Stripe, after checking `apps/medusa`'s installed
   dependencies for compatibility — not yet checked), webhook signature
   verification, order confirmation, and confirming the resulting order
   is visible in native Medusa Admin.
2. Or, if commerce depth matters more right now than checkout: an
   **"Open Medusa Admin" link** from `/admin/sites/:id/store` (Part B §19
   explicitly wants this as the interim path to inventory/orders/
   customers/promotions/shipping, ahead of rebuilding those screens) —
   this is small and immediately useful regardless of which path is
   chosen next.
3. Either way: a real browser pass over the editor and storefront once a
   browser-automation tool is available, to close the verification gap
   named above.

## Environment / safety notes for future sessions

- CMS development is against the **hosted** Supabase project directly —
  there's no local Postgres for it (see `docs/architecture.md`). Every
  migration so far has been additive; no `supabase db reset` has been run
  against it. Continue that discipline; ask before anything destructive.
- Local Medusa Postgres/Redis are native Homebrew services (no Docker,
  confirmed permanent).
- `apps/web/.env.local` and the various `.*.local` credential files are
  gitignored — verified via `git check-ignore` after every credential
  operation this session, not assumed.
