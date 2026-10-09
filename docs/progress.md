# Progress

Last updated: 2026-10-08, end of the session that ported the prototype's
E-Commerce/Store screens (Products, Website Pages, both dialogs) into the
CMS overview. Earlier: 2026-09-21 guest checkout + real-browser
verification (on top of the
storefront/cart commit `14b79f4`, the security-fix commit `1761598`, and
the pre-existing `b5ded70`). This file is the current source of truth for
what's actually built — `docs/implementation-plan.md`'s milestone
numbering is kept for traceability to the original requirements, not as
the authoritative sequence.

## What actually works right now

Verified live against the hosted Supabase project (`nsfcmwlbippjjlpvjoyd`)
and a local Medusa v2 instance (`http://localhost:9000`) — and, new this
session, verified through a **real browser** via Playwright, not just
curl/typecheck/unit tests.

**CMS core (M0-M2):** unchanged from the previous session — see git
history — still passing (`pnpm test:rls` 10/10, `pnpm test:publish`
18/18).

**Commerce, hardened (this session, work order reviewing `62fd000`):**
- **Public product API** (`api.storefront-products.tsx`) now resolves
  the site strictly from the verified hostname mapping
  (`resolveSiteIdByHost`); an arbitrary `?siteId=` can no longer select a
  different site's data — a mismatched query param gets the same
  "Unknown site" 404 as a bogus one, so it can't be used to probe which
  site IDs exist.
- **New staff-only preview endpoint** (`api.preview-storefront-products.tsx`)
  for editing sites that don't (yet) have a public domain — requires a
  real Supabase session and confirms workspace access via the normal
  RLS-backed `sites` select, no hand-rolled permission logic. The Puck
  component registry picks between the public and preview endpoint via
  a `mode: "preview" | "public"` field on `StorefrontMetadata`, decided
  server-side by which route is rendering.
- **Cart session** now requires a real, non-placeholder `SESSION_SECRET`
  (rejects `changeme`/`secret`/`placeholder`/`test`/`example`/`xxx`-like
  values at startup rather than silently issuing an unsigned cookie), and
  the signed cookie payload is bound to site + commerce-connection
  fingerprint + region, not just the cookie name — so a stale cart from a
  since-changed backend/region/key is detected and discarded rather than
  reused against the wrong store. GET requests (`peekCart`) no longer
  create a cart merely by loading `/cart`; only a real mutation
  (`resolveCart`) creates one. Quantities are validated as strict
  integers in `[1, 99]`; line-item mutations verify the item actually
  belongs to the cart first.
- **Region readiness**: `resolveStorefront()` now prefers a per-site
  `commerce_connections.default_region_id` when set, falling back to the
  first region otherwise — an explicit single-region configuration
  (multi-region selection UI is still out of scope, named below), set
  from a new "Store setup" region `<select>` in `/admin/sites/:id/store`.
- **Editor document validator** rewritten from reject-unknown-props to
  **strip-unknown-props**: builds a sanitized authoring projection
  (recognized fields only, per component, including nested slots) before
  persisting, instead of either accepting arbitrary render props or
  rejecting the whole save. This was required, not cosmetic — see bug #4
  below.
- **Editor save/navigation**: autosave requests now queue (a publish
  requested while an autosave is in flight is queued and sent after,
  never dropped or racing it), and "back" navigation flushes any pending
  edit and waits for a confirmed save before calling `navigate()`,
  instead of firing-and-forgetting.
- **"Open Medusa Admin" link** added to `/admin/sites/:id/store` —
  opens the connection's already-configured `backend_url` + `/app` in a
  new tab, explicitly labeled as separate authentication (not SSO, no
  credentials in the URL, no iframe).
- **Guest checkout** (`/checkout`, `/checkout/confirmation`, new routes):
  address collection with server-side country validation against the
  region's allowed countries → real Medusa shipping options (chosen
  option's price always re-read from Medusa, never trusted from the
  submitted form) → payment. Two payment paths, reported separately per
  the work order's instruction:
  - **Manual/system-default test order** (Medusa's built-in
    `pp_system_default` provider): creates a payment collection, inits a
    payment session, then completes the cart via Medusa's own
    `/store/carts/:id/complete` — **verified end-to-end**, including a
    real order visible in native Medusa Admin (display_id 3).
  - **Stripe (test mode)**: `@medusajs/payment-stripe` +
    `@medusajs/payment` installed and conditionally registered in
    `medusa-config.ts` (only if `STRIPE_API_KEY` is set), with
    `STRIPE_API_KEY`/`STRIPE_WEBHOOK_SECRET` documented in
    `apps/medusa/.env.template`. **Not verified** — no test credentials
    are available in this environment. Nothing Stripe-specific (Elements
    mounting, webhook signature verification, capture-vs-authorize) has
    been exercised. This is explicitly *not* presented as a verified
    Stripe payment.
  - Order confirmation is reachable **only** via a signed,
    site-scoped, 24h-expiry `drcms_order_<siteId>` cookie set at
    checkout completion — there is no order ID in the confirmation URL.
    Confirmed by direct curl that Medusa's raw `/store/orders/:id`
    accepts *any* order ID with just the publishable key (no per-order
    auth), so this cookie is the actual access boundary, not a
    convenience.
- Cart/checkout/confirmation/preview routes now send
  `Cache-Control: private, no-store`.

## Real-browser verification (new this session)

Previous sessions were blocked on "no browser-automation tool is
available" (checked via `ToolSearch` only). This session re-checked by
inspecting the actual environment/dependencies directly instead of
relying on that absence, found `@playwright/test` installable and
Chromium launchable, and used it for real: `apps/web/playwright.config.ts`
(desktop 1600×1000 + mobile Pixel 7 projects, screenshots/traces on
failure only, artifacts gitignored), `apps/web/e2e/storefront-checkout.spec.ts`
(4 tests) and `apps/web/e2e/editor.spec.ts` (2 tests, desktop-only — Puck's
editor chrome isn't built for mobile viewports, same as any comparable
page builder, so it's excluded via `testIgnore` rather than forced).

```
pnpm --filter @digital-romanian/web exec playwright test
10 passed (33.9s)
```
covering: real SSR product content (not client-fetched), unknown-host/
unknown-product 404s, the full flow browse → variant → add to cart →
persistent cart → checkout → manual test order → confirmation,
confirmation rejecting access without the order-access cookie, the
editor's live preview rendering real resolved products, an actual
inspector-field edit autosaving without the resolved-data-stripping bug,
and back-navigation correctly waiting for a pending save.

**Four bugs were found only by this real-browser pass** (none would have
been caught by typecheck, unit tests, or curl):
1. `ShippingMethodSchema` required `name` as a plain string, but a cart's
   own `shipping_methods[]` entries never include `name` (only the
   separate `/store/shipping-options` listing does) — every real
   `addShippingMethod` call failed zod validation. Fixed by making `name`
   nullable/optional.
2. The manual-order completion path called `completeCart` without first
   creating a payment collection and initializing a payment session —
   Medusa rejected with "Payment collection has not been initiated for
   cart". Fixed by adding those two steps first.
3. Checkout's completion action returned a JSON `redirectTo` field the UI
   never acted on, so clicking "place order" silently did nothing.
   Fixed by using a real `redirect()` to `/checkout/confirmation`.
4. The editor canvas rendered at ~48–288px wide — unusable. Root-caused
   via `page.evaluate` reading computed styles: Puck's own fixed 4-column
   layout needs 750px+ for its panels alone, but the parent admin
   layout's `.admin-shell` (`max-w-3xl` = 768px, meant for ordinary forms)
   left almost nothing for the canvas. Fixed by making the editor route's
   root render `position: fixed; inset: 0`, breaking out of that wrapper
   (canvas width confirmed via `boundingBox()`: 288px → 844px).

Also, separately, the real Puck autosave payload was captured and found
to include `resolvedProducts`/`resolvedCurrency`/`resolvedError` merged
into `ProductGrid`'s props — the previous validator's reject-unknown-prop
behavior returned 400 on every real autosave of a page containing a
ProductGrid. This is what motivated the strip-rather-than-reject
validator rewrite above (found and confirmed via this same browser pass,
not assumed from reading the code).

## Bugs found and fixed in earlier sessions

See prior revisions of this file / commit history for the RLS timing bug,
the `publish_site`/`rollback_site` NULL-role bypass, and the SSRF
private-IP-in-dev bypass — all still fixed, regression-tested, unaffected
by this session's changes.

## Credential rotation

No new credential exposure this session. See commit history for the
Medusa admin password / secret API key rotation from the previous
session (still valid, not re-rotated without cause).

## Known gaps / deliberate simplifications (not hidden)

- **Stripe test-mode payment**: installed and wired, not verified — no
  test credentials in this environment (see above). Next session should
  either obtain `STRIPE_API_KEY`/`STRIPE_WEBHOOK_SECRET` (test mode) or
  explicitly decide to ship with the manual/system-default provider only.
- **Multi-region stores**: only the single-`default_region_id` path is
  built and tested. A store with multiple regions will still work (falls
  back to the first region if unset) but per-region currency/shipping
  selection in the storefront UI itself is not built.
- **"Open Medusa Admin" link**: exists and points at the right URL, but
  wasn't click-tested in a browser session this round (no admin user
  session was driven through Playwright for it).
- **ProductGrid category/collection field** is a plain text ID input,
  not a picker UI.
- **Domain "verification"** in `/admin` (`site.tsx`/`site_domains`) is an
  explicit manual flag, not real DNS record checking — labeled as such.
- **Store admin parity**: only Setup/status, Products, and now the
  Medusa Admin link exist. Inventory, orders, customers, promotions,
  shipping/regions, presentation screens are still deferred (Part B §19's
  explicit interim-delivery decision).
- **No production deploy target** chosen for `apps/medusa` yet (needs a
  persistent Node host, not Vercel — see `docs/architecture.md`). Nothing
  has been provisioned or deployed this session.
- **Cross-site cart/connection isolation** with two live sites is still
  not empirically tested with two real sites (structurally guaranteed by
  two independent mechanisms — site-scoped cookie name + host-only
  cookie + distinct verified hostname per site — same reasoning as
  before, still not re-verified with a second live site).

## Verification categories — stated separately, per the work order

- **Manual order verified**: yes. A real guest checkout using Medusa's
  built-in system-default payment provider produced a real order,
  confirmed visible in native Medusa Admin (display_id 3).
- **Provider (Stripe) test payment verified**: no. Not implemented beyond
  installing/registering the module — no test credentials available.
- **Browser flow verified**: yes, via Playwright against a real Chromium
  browser (not curl) — 10/10 tests passing across desktop + mobile
  (storefront) and desktop (editor). See bugs #1-4 above, all only
  found this way.
- **Deployed environment verified**: no. Everything above is against
  local dev (Medusa on `localhost:9000`) and the hosted Supabase project;
  nothing has been deployed to a staging or production host this session.

None of these four is being used as proof of another.

## Next executable action

In priority order:

1. **Stripe test-mode payment**: obtain test credentials
   (`sk_test_...`/`whsec_...`), verify the module activates, implement
   the Elements-based client flow (provider-hosted fields, no raw card
   data through the CMS), verify the webhook route with real signature
   verification, and test double-click/retry/webhook-race scenarios
   before calling it verified.
2. **Deployment staging gate** (separate from and after the above):
   provision an independently-hosted Medusa instance (server/worker
   split, managed PostgreSQL/Redis/file storage), configure CORS for the
   real deployed CMS origin, re-run this session's Playwright suite
   against that staging environment, and only then consider a Vercel
   deploy of `apps/web` pointed at it. Nothing here should be
   provisioned without a separate, explicit go-ahead — this is a new
   category of action (hosted infrastructure, not a local dev change).
3. Multi-region storefront UI (currency/region switching), if/when a
   multi-region store is actually needed.

## Environment / safety notes for future sessions

- CMS development is against the **hosted** Supabase project directly —
  there's no local Postgres for it (see `docs/architecture.md`). Every
  migration so far (including this session's additive
  `default_region_id` column) has been additive; no `supabase db reset`
  has been run against it. Continue that discipline; ask before anything
  destructive.
- Local Medusa Postgres/Redis are native Homebrew services (no Docker,
  confirmed permanent).
- `apps/web/.env.local`, `.*.local` credential files, and Playwright's
  `test-results/`/`playwright-report/`/`playwright/.cache/` output are
  all gitignored.
- Playwright + Chromium are confirmed working in this environment (see
  `CLAUDE.md`) — do not report browser verification as blocked without
  first checking directly (`npx playwright install` /
  `pnpm exec playwright test`), regardless of what a tool search for a
  browser-automation MCP connector returns.

## Builder and shop feature expansion — 23 September 2026

Added a dedicated searchable/filterable Pages screen, blank/optional starter
creation, page settings, duplication and explicit draft removal. Reserved CMS
and commerce paths are validated; page settings use optimistic concurrency.
Private staff-only draft previews resolve real commerce data server-side and
send no-store/noindex headers. Publishing now has a dedicated site-wide review,
real draft/live comparisons, removed-page visibility, a stale-review check,
release labels and confirmed rollback. The review token is checked before the
existing atomic publish RPC; it is not a database-level lock against concurrent
edits after that check.

Expanded the Puck library with image, spacer, divider, responsive columns,
card, FAQ, featured product picker and shop/cart buttons. Existing Product grid
remains connected to Medusa. Added optional introduction/about/contact/shop starters
and search title/description fields. Blank remains empty. Editor Preview and
Review & publish wait for saves; failures expose retry and draft download.

Store Products now supports search/pagination, connection-error states and
creating an actual Medusa product **draft** through the guarded server adapter.
Variants, prices, shipping, stock, sales-channel availability and product
publication continue in native Medusa Admin. No automatic product publication,
paid services, hosted migration, or new payment provider is introduced. Public
shop search and shop/cart navigation connect the customer journey.

Verification passed: TypeScript, production build, 27 unit tests and all nine
Playwright feature flows against the built application with isolated local
Supabase/Medusa service doubles. Browser coverage includes page creation,
autosave recovery, private preview, reviewed publication, stale-write rejection,
product draft creation, featured-product selection, catalog search, viewer
restrictions and mobile page-list layout. No hosted data writes, deployment or
live payment verification were performed.

The browser tests exposed and fixed two integration issues: Puck external
pickers must receive their scoped data source before mounting, and editor
navigation must track authored changes immediately plus the version of the
in-flight save. A product selection followed immediately by Preview now waits
for the latest draft rather than leaving on an older save acknowledgment.

## Workspace/admin UI parity + overview pixel-match — 6 October 2026

Worked from `digital-romanian-screen.html` (the prototype) as the source of
truth to bring the workspace admin screens and the site **overview** into
visual parity. All changes are presentation + a delete-latency fix; no
migrations, no hosted writes, nothing deployed.

- **Settings screen** rewritten to match the prototype (slug uniqueness fixed,
  `.owner-badge` gated by `isOwner`, save validates name+slug client- and
  server-side). Transfer-ownership and delete-workspace dialogs match the
  prototype's typed-confirmation flows.
- **Overview screen** (`overview.tsx`) aligned to the prototype's
  `<section data-route="/overview">`:
  - restored the prototype's overview-scoped "pixel-matched" CSS block
    (prototype lines 1341-1469) into `digital-romanian.css`, scoped to
    `[data-route="/overview"]`, and added `data-route="/overview"` to the
    `.app` wrapper;
  - topbar no longer shows a workspace crumb or `/` separators — `nav.crumbs`
    is the site switcher + `tb-extras` domain chip directly;
  - `HealthRing` uses `r=47`/`stroke-width:6` (`C = 2π·47`);
  - inline 18×18 Overview (home) and Media icons, matching the prototype;
  - `ov-foot` workspace switcher wraps the mark in `.ws-switch-mark` and uses
    `strong.ws-switch-name`;
  - `AccountMenu` gained a `size` prop (default 32); overview passes `22`.
- **Root cause of residual a few-px height drift:** the app's Tailwind
  preflight sets `line-height: 1.5` globally, while the prototype inherits the
  browser default `normal`. Restored the prototype value within the overview
  (`[data-route="/overview"] .ov`, `.tb-domain`) rather than changing global
  line-height.
- **Site deletion latency** (`workspace-sites.tsx`): the card now disappears
  immediately on delete via `useNavigation` (`intent === "delete-site"`) and an
  optimistic filter on the list, with React Router restoring it on error,
  instead of waiting for the round trip.

Verification (this session, all against the built app + isolated local service
doubles): TypeScript clean; production build clean; **all 15 Playwright feature
flows pass** (previously 9 in the last recorded run — the suite now also covers
role change, settings save, ownership transfer and workspaced deletion).
Overview parity was verified without screenshots (the model cannot read images):
rendered DOM/class skeletons and computed styles were captured from the
prototype and the running app at 1440x900 and diffed. All structural and
computed-style differences now match; the only remaining deltas are
data-driven (the fixture site is a draft/offline so it shows 3 issues vs the
prototype's 2, and its first status pill is grey rather than orange).

## Store screens (Products / Website Pages) + dialog fixes — 8 October 2026

Ported the remaining `digital-romanian-screen.html` screens into the CMS
overview so the sidebar's "E-Commerce / Store" group opens **Website Pages**
(`/overview/pages`) and **Products** (`/overview/products`), with the
prototype's Add Page / Add-Edit Product dialogs. All presentation-level; no
migrations, no hosted writes, nothing deployed. The prototype's mock
catalogue is ported as-is: Medusa stays authoritative for real products,
and no Medusa data is read or written by these tables (deliberate, keep).

- **New `app/components/overview-screens.tsx`**: `PagesView`, `ProductsView`,
  `ProductDialog`, `PageDialog`, `generateProducts`/`generatePages`,
  toasts, status toggles, duplicate — wired into `overview.tsx` via a
  `siteView` segment (splat route `overview/*`), matching the prototype's
  `#/overview/products` view switching.
- **Bug fixed — "Add New Product closes immediately":** React Router's
  default `entry.client` wraps the app in `StrictMode`; its effect replay
  runs the dialog effect's cleanup `close()` before the async `close`
  event dispatches, so `onClose -> onCancel -> parent unmount` fired the
  instant the dialog opened (dev only; production has no StrictMode, which
  is why it first showed up on the dev server). Both dialogs now set a
  `closingRef` flag right before a programmatic close and ignore exactly
  that close event. Verified in dev: dialog stays open, Escape/backdrop/
  Cancel/submit/edit all behave, reopen works, zero console errors.
- **Bug fixed — empty Products + wrong page icons on a new site:** the
  prototype gates its demo data on `isShop(s)` (theme `alicia`/`sun`), and
  a fresh "Untitled site" gets theme `plain`, so it rendered an empty
  products table and Services/Case Studies (`i-doc`) pages instead of the
  file's Shop Storefront/About Our Farm set (`i-store`/`i-tractor`/
  `i-phone`). The gate was removed: every site now gets the file's dummy
  default catalogue and pages (deliberate deviation from the prototype,
  per the work order). Theme-based preview cards on `/workspace` are
  unchanged.
- **Sprite verified complete:** all 43 shared symbols in `dr-sprite.tsx`
  are body-identical to the prototype's after whitespace normalization
  (only app-only extra: `i-arrow-left`). Removed a malformed trailing
  duplicate `i-send` symbol left by an earlier sprite edit.
- **Fixture fix (`e2e/support/feature-server.mjs`):** the mock Supabase
  never defaulted `updated_at`, so creating a second site crashed
  `loadWorkspaceScreen`'s `localeCompare` sort (real Postgres has the
  column default; the mock now seeds and inserts one).

Verification: `pnpm typecheck` clean; **`pnpm test:features` 15/15 on a
fresh production build**; dev-browser probes covered the dialog lifecycle
(open stays open, 5 validation errors, Escape/backdrop close, full add
flow, edit/cancel, page dialog path autofill + add) and confirmed a newly
created plain-theme site shows all 8 dummy products and the prototype's
4 pages with correct icons. Cleanup: all `probe*.tmp.mjs`/`out/` scratch
files deleted. One security note: an untracked `error.txt` at the repo
root contained a GitHub PAT — file deleted, **token still needs revoking**.

## Responsive/mobile pass + instant workspace nav — 9 October 2026

Worked from `digital-romanian-screen-responsive (4).html` (the responsive
prototype). App was the reference for `/overview`; the exact fix was then
mirrored into the HTML. Presentation + a navigation-loading fix; no
migrations, no hosted writes, nothing deployed.

- **Shell brand in the mobile drawer/topbar** (`workspace-shell.tsx`),
  plus the earlier workspace-sites "create" button now uses `useSubmit`
  (`workspace-sites.tsx`) so it behaves as a real form submit.
- **Teams mobile rows** now left-align: the `≤900px` `.mrow` layout in
  `digital-romanian.css` was rewritten to a 2-column
  `minmax(0,1fr) auto` grid — name/menu on row 1, all other cells stacked
  in column 1 padded left — and the identical fix was mirrored into the
  HTML (`:2239`).
- **Overview profile/bell parity**: `AccountMenu` now uses its default
  `size=32` on `/overview` (was `22`), matching the workspace shell; the
  HTML `meMark(32)` was mirrored. Overview responsive breakpoints were
  re-aligned to the app (`1100→1280`), plus a new `761–960px` stacked
  `.srow` variant.
- **Site Status / remaining mobile overrides**: the desktop Figma block
  scopes every rule with `[data-route="/overview"]`, which out-specified
  the old single-class phone rules. Fixed `.ov-health/.ov-status` with a
  `[data-route="/overview"] .ov-card...` block, and added a final
  `[data-route="/overview"]`-scoped `≤760`/`≤400` block covering `.hbody`,
  `.qstats`, `.qstat`, `.ov-pages`, `.ov-health` and `.prow` (mirrors the
  HTML's own `[data-route]`-scoped phone rules).
- **Instant workspace ↔ overview navigation**: new
  `app/routes/workspace-data.tsx` — a pathless layout that owns
  `loadWorkspaceScreen` + `shouldRevalidate` (skips revalidation for
  client moves inside the workspace area or `/overview*`) and renders the
  `<Outlet/>`. `routes.ts` nests both the workspace section layout and
  `overview/*` under it; `workspace.tsx`/`overview.tsx` dropped their own
  loaders and read `useRouteLoaderData("routes/workspace-data")` instead.
  (React Router framework mode `<Link prefetch>` does **not** prefetch
  loader data, so this replaces the discarded prefetch idea.)

Verification: `pnpm typecheck` clean and production build clean; a browser
probe confirmed workspace↔overview navigation re-runs the loader **0**
times; an HTML-vs-APP computed-style diff over the overview at
1200/900/700/390/320 px now shows no CSS differences (remaining deltas are
data-driven — the fixture site is draft/offline — or the app's deliberate
"stack tables below 1200px" choice). All temporary probe specs/configs
(`shots-tmp`, `perf-tmp`, `playwright.tmp`/`devtmp`, `shots/`) removed.

## Checkout Settings port + Orders "View" desktop alignment — 10 October 2026

Ported the prototype's **Checkout Settings** screen (`#/overview/checkout`)
and corrected the Orders table's "View" action alignment. Presentation only;
no migrations, no hosted writes, nothing deployed.

- **Checkout Settings** (`overview-screens.tsx`, `overview.tsx`,
  `overview.css`): added exported `Checkout`/`ShippingZone` types plus
  `CheckoutView`/`ShipDialog` and `generateCheckout`, mirroring the
  prototype's `renderCheckoutView()` and `#dlg-ship` dialog one-for-one —
  Paystack/COD gateway toggles with key masking and "keep one channel on"
  guard, shipping zones list with add/edit/delete + Undo toast and the
  "No shipping rates yet" empty state. State is held per-site in
  `overview.tsx` (`checkoutBySite`) so edits survive moving between store
  views; the sidebar's "Checkout Settings" is now a real link and the store
  group opens on it.
- **Orders "View" alignment** (`overview.css`, mirrored into
  `digital-romanian-screen.html`): the desktop table had
  `.otab-row .o-act { justify-self: end }`, shoving View to the right edge
  while the "Actions" column head sits left. The base rule stays `end` (the
  stacked mobile/tablet rows keep their right-aligned action) and a new
  desktop-only rule — `@media (min-width: 1201px) { .otab-row .o-act
  { justify-self: start } }` in the app, `min-width: 1101px` in the HTML —
  aligns View under the Actions head. First attempt dropped the base rule to
  `start`, which out-specified the `≤760` action rule and broke the mobile
  layout; the media-scoped override fixes desktop only.

Verification: `pnpm typecheck` clean and production build clean; a temporary
Playwright geometry spec (deleted after) confirmed the desktop View's left
edge equals the "Actions" header (`x=1214.98` at 1400px) and the mobile View
stays flush right at 390px, with a 12-width sweep (320→1400) showing the
action right-aligned everywhere below 1200px.

**Security note:** a GitHub PAT was exposed in this session's transcript and
used once for a push; it must be **revoked/rotated**. It was never written to
any committed file.
