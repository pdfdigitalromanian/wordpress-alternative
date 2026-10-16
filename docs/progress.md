# Progress

Last updated: 2026-10-15, the session that ported three more prototype
surfaces from `wp.html` one-for-one: the **Content** view (article
management table + add/edit article dialog + a rich-text Content Body
editor + article SEO sub-dialog), the Site Settings **Danger Zone** tab
(unpublish / transfer / delete panels + confirmation dialog), and a
rebuilt **Analytics & Pixels** panel (per-tool catalog rows with an
Active/Paused chip, "On" switch, Copy ID + remove, an in-list "Add
tracking tool" row opening a searchable grouped picker, dirty-state
note/`Discard`/`Save Tracking Configuration` bar, and the
`PX_CODE_ON = false` custom Header Code row hidden exactly as in the
prototype). Content data, danger actions and pixels stay client-side,
per-site state mirroring the prototype — no schema change.
Before that, same day, the session that (a) ported three further
prototype changes from the design HTML one-for-one: the Site Settings
**Custom Domain** tab's pending domain + live DNS verification dialog, the
add/edit **product dialog** slide-in/out animation, and the **Create a new
website** 3-step wizard behind the existing create buttons; then (b) synced
the app to the re-saved prototype `wp.html` — the **Site Permissions** tab
removed, "Website Pages" renamed **Pages** with its row icons dropped,
"Content/CMS" renamed **Content**, and the wizard's first step rebuilt as a
description + category-chips screen with Back/Skip/Continue.
The prototype HTML was renamed from `digital-romanian-screen.html` to
`wp.html` (the old name no longer exists).
Before that, same day: the session that replaced the Site
Settings "Coming soon" placeholders on the **Branding & Favicon** and
**Analytics & Pixels** tabs with the prototype's full panels, widened the
favicon upload to PNG/JPG/WebP/GIF/SVG/ICO with a client-side square crop,
then synced both panels and their CSS to the prototype HTML's compact
values one-for-one (an earlier Figma "re-measure" of those panels was
reverted in the prototype and so was reverted here).
Before that: 2026-10-14, the session that ported the prototype's
Site & Store Analytics and Site Settings screens (plus the sidebar's Store
label, Analytics row and Site Settings link) into the CMS overview.
Earlier: 2026-10-08, E-Commerce/Store screens (Products, Website Pages,
both dialogs). Before that: 2026-09-21 guest checkout + real-browser
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

## Products: archived status + menu parity, SEO dialog port - 13 October 2026

Ported the prototype's product **SEO** feature and brought the product
three-dot menu to full parity. Presentation only; no migrations, no hosted
writes, nothing deployed. The categories image upload (below) was already in
the working tree; this session verified it and completed the remaining two
gaps.

- **Product menu parity** (`overview-screens.tsx`): row menu is now
  `Edit / Duplicate / [Publish when draft] / Archive|Restore / � / Delete
  product`, matching `digital-romanian-screen.html` (lines ~4943-4952).
  Replaced `toggleStatus` with `publish()` and `toggleArchive()`; split the
  `out` filter to `status === "published"` and added `archived` to `FILTERS`
  + `statusPill` (`Product.status` widened to include `"archived"`). Added
  `.spill2.archived` to `overview.css`; filter expression now mirrors the
  prototype's `prodList()` one-for-one.
- **Product SEO** (`overview-screens.tsx`, `overview.css`, `overview.tsx`):
  ported the `pf-seo` summary card inside the product dialog plus the
  separate `modal-seo` "Search engine listing" dialog � title/meta/slug with
  per-field auto-generation (`seoSlug`/`seoTwo`/`seoCut`, `SEO_T=60`,
  `SEO_D=160`), live Google preview, character meters, "Show on search
  engines" switch, snapshot-restore on cancel and "Reset to auto-generated".
  `ProductDialog` now takes `siteName`/`domain`/`showToast`; `ProductsView`
  takes `d` and `overview.tsx` passes `d={dashboard}`. New `ProductSeo` type;
  `Product.seo?` + `ProductDraft.seo` persist overrides with the
  prototype's `seoAuto` flags. CSS ported verbatim from the prototype
  (lines ~1695-1753).
- **Categories image upload** (pre-existing working diff): `Category.img`,
  `generateCategories` seed, row thumb fallback `c.img || photoUrl(photo)`,
  and the `CategoryDialog` drag/drop upload bar.

Verification: `pnpm --filter @digital-romanian/web typecheck` clean and
`pnpm --filter @digital-romanian/web build` clean. Prototype semantics for
the menu, filter, archive/publish toasts, `statusPill` and the SEO
auto/override logic were diffed line-for-line against
`digital-romanian-screen.html`. No existing e2e spec touches the overview
product dialog/menu.

## Analytics + Site Settings port, sidebar reorg - 14 October 2026

Ported the prototype's **Site & Store Analytics** and **Site Settings**
views into the CMS overview, and brought the sidebar into line with
`digital-romanian-screen.html`. Presentation only; no migrations, no
hosted writes, nothing deployed.

- **Sidebar** (`overview.tsx`): renamed the group label "E-Commerce /
  Store" to **Store** (prototype line 3535); added an **Analytics** row
  (`/overview/analytics`, prototype line 3543) between the Store group and
  Content/CMS with its own inline bar-chart glyph (`ANALYTICS_ICON`); and
  turned the previously inert **Site Settings** row into a real `Link`
  to `/overview/settings`. `SITE_VIEW_TITLES` gained `analytics` and
  `settings` so `document.title` and route matching resolve them.
- **Analytics** (`overview-screens.tsx`): exported `AnalyticsView` - KPI
  cards, an SVG `TrafficChart` (port of the prototype's imperative
  `drawChart()`, rendered client-side only so SSR stays deterministic),
  timeframe MoreMenu, top pages / top sellers lists, and a CSV export.
  Ported helpers `anSeries` / `anCompute` and the deterministic demo
  series.
- **Site Settings** (`overview-screens.tsx`): exported `SettingsView` with
  the prototype's tab set, plus the `DomainDialog` -> `DnsDialog` custom
  domain flow (`normDomain`, `DOMAIN_RE`, record table). `overview.tsx`
  holds a per-site `domainBySite` override fed through `siteData`, so the
  topbar `ov-domain` and the settings panel update when a domain is
  connected - nothing is written to Medusa or Supabase.
- **CSS** (`overview.css`): appended the `.an-*` / `.ss-*` / `.dm-*` /
  `.dns-*` / `.modal-domain` block and `.soon-tag`, verbatim from the
  prototype.
- **Onboarding order** (work order same session): removed the "Step 2 of 2"
  label from `/onboarding/workspace`, and made the profile step always
  precede the workspace step. `loadWorkspaceScreen` (`workspace.server.ts`)
  and the `/onboarding/workspace` loader now redirect an account with no
  `display_name` to `/onboarding/profile`, so an account that already has a
  workspace (an accepted invite, or one created after skipping the profile
  step) no longer renders the shell directly. The profile page's "Skip for
  now" is now an edit-only "Cancel"; during sign-up onboarding the profile
  step is mandatory, so there is nothing to skip past.
- **Skip a step that is already satisfied**: onboarding is now symmetric -
  the entry decision (`landingFor`) already skipped an existing profile, and
  now a directly-opened `/onboarding/workspace` redirects to `/workspace`
  when the account already has a membership (`onboarding-workspace.tsx`),
  and a directly-opened `/onboarding/profile` skips ahead to
  `/onboarding/workspace` (or `/workspace`) when a `display_name` is set.
  Editing (`?returnTo=`, from the account menu) is exempt so "Edit profile"
  still opens the form.
- **Workspace logo preview is now a circle** (`digital-romanian.css`): the
  `.picker.square` face and its modal override were `border-radius: 22px` /
  `18px` (a rounded square, per `digital-romanian-screen.html:536`) while
  the Settings workspace avatar (`.sic .ws-av`) is a circle - the mismatch
  read as "sometimes not a circle / oval". Both picker faces are now
  `border-radius: 50%` so the uploaded logo is a perfect circle everywhere
  it is previewed. This deliberately deviates from the prototype's rounded
  square.

Verification: `pnpm --filter @digital-romanian/web typecheck` clean and
`pnpm --filter @digital-romanian/web build` clean. Browser-verified via
Playwright against the local `e2e/support/feature-server.mjs` fixture (no
hosted services): three temporary specs confirmed the Store group +
Analytics + Site Settings sidebar links, the Analytics heading/chart, and
the Settings heading + domain panel; the temp spec/config were removed
after the run, so no new committed e2e coverage exists (consistent with
the overview screens above). A second temporary probe (fixture user with
no `display_name`) confirmed login lands on `/onboarding/profile`, and both
`/onboarding/workspace` and `/workspace` redirect there; the fixture edit
and temp files were reverted after the run.

## Site Settings: Branding & Favicon + Analytics & Pixels panels - 15 October 2026

Replaced the two "Coming soon" placeholders on the Site Settings tabs with
the prototype's full panels, ported one-for-one from
`digital-romanian-screen.html` (`brandingPanel`/`wireBranding` ~6283-6363,
`pixelsPanel`/`wirePixels` ~6365-6439). Presentation only; no migrations,
no hosted writes, nothing deployed.

- **Branding & Favicon** (`overview-screens.tsx`): new `BrandingPanel` -
  site name, favicon upload (click/drag-drop with a live preview that falls
  back to the site initial), and Global Site Default SEO (meta title with a
  60-char pill, meta description with a 300-char counter). Save validates a
  non-empty name, persists and toasts; an over-length title gets the
  prototype's "Google may shorten it" toast. (The accepted formats were
  later widened, and the Remove/Discard affordances plus the hint line were
  later dropped so the panel matches the re-measured prototype - see the two
  subsections below.)
- **Analytics & Pixels** (`overview-screens.tsx`): new `PixelsPanel` - GA
  Measurement ID (uppercased/`[A-Z0-9-]`) and Meta Pixel ID (digits only)
  rows with per-field Copy ID, the custom header-code row with a
  snippet/toggle editor, and "Save Tracking Configuration". Validation
  mirrors `PX_RULES` (`G-XXXXXXXXXX`, 15-16 digits), an unclosed `<script>`
  in the custom code reopens the editor with a toast, and the save toast
  reports how many tools are active on the site.
- **State** (`overview.tsx`): added exported `Branding`/`Pixels` types and
  `generateBranding`/`generatePixels` seeds (shop sites get the prototype's
  favicon + poultry meta defaults, via `isShopSite`). Held per site in new
  `brandingBySite`/`pixelsBySite` maps with `setSiteBranding`/`setSitePixels`
  updaters, matching the pages/products/orders/checkout pattern, so saved
  values survive moving between the site views. `SettingsView` takes the
  value + updater as props; `SS_SOON` now only backs the Danger Zone tab.
- **CSS** (`overview.css`): appended the prototype's `.br-*` / `.px-*`
  blocks (including the `760px` media query) verbatim. (These values were
  later replaced by the re-measured block - see the second subsection below.)

Verification: `pnpm typecheck` clean and
`pnpm --filter @digital-romanian/web build` clean. Browser-verified via
Playwright against the local `e2e/support/feature-server.mjs` fixture (no
hosted services): a temporary spec signed in, selected the fixture site,
opened Site Settings, and confirmed the Branding heading/name/title, the
live 19/300 description counter, the Pixels heading + GA row + save button,
and the custom-code editor updating its snippet. The temp spec/config and
screenshots were removed after the run, so no new committed e2e coverage
exists (consistent with the overview screens above).

### Favicon upload: wider formats + client-side square crop - 15 October 2026

Follow-up work order on the same panel. The favicon input now accepts
PNG, JPG, WebP, GIF, SVG and ICO (accept list + type check; rejection
message "Use a PNG, JPG, WebP, SVG or ICO image.") and raises the cap to
5 MB.

- **SVG / ICO** are kept exactly as uploaded (data URL, no re-encode).
- **Raster (PNG/JPG/WebP/GIF)** go through `take()`: decode, crop a centred
  square (`side = min(w, h)`), draw onto a canvas at `min(side, 512)` and
  store `canvas.toDataURL("image/png")`. Errors/toasts: `< 32px` → "That
  image is too small. Use one that is at least 32 × 32px."; non-square →
  toast "Your image wasn't square, so it was cropped to the centre.";
  square but `< 512px` → toast "Favicon added. A 512 × 512px image will
  look sharper on phones."; decode failure → "That image couldn't be
  opened. Try another file." Drag-and-drop calls the same `take()`.

Verification: `pnpm typecheck` and production build clean; a temporary
Playwright spec against the fixture dispatched real canvas-generated files
to `#br-file` and confirmed the exact accept attribute, the wrong-type
error, the too-small error, the non-square crop (preview `src` becomes
`data:image/png` + "wasn't square" toast), the small-square toast, an SVG
kept as `data:image/svg+xml`, and a dropped too-small file hitting the same
error. Temp spec/config/screenshot removed after the run. (The drop-box
label was later reverted to the prototype's wording, and the hint line
dropped, in the sync below.)

### Panels matched to the prototype HTML - 15 October 2026

The prototype's `digital-romanian-screen.html` had been briefly regenerated
with values "re-measured from Figma" and the React panels were synced to
that revision; the prototype then reverted to its **compact** values (the
file was re-edited again at 02:25). The React panels and CSS were re-synced
to the *current* prototype one-for-one. To settle it objectively, the two
were measured with a throwaway Playwright spec: every relevant computed
property (font-size/weight/colour, box metrics, padding, margin, gap,
grid-template-columns, min-height) was compared between the prototype
(`file://…#/overview/settings`) and the React app (`/overview/settings`),
and every value now matches exactly in both panels.

- **CSS** (`overview.css`): `.br-*` / `.px-*` now mirror the prototype
  verbatim. Notes that mattered:
  - The `.br-h` heading rule stays 19px/500 in the file but is **dead
    code** in both the prototype and the app — the base
    `[data-route="/overview"] .ov-card h2` (16px/600) wins on specificity,
    so `h2.br-h` renders 16px/600. The earlier `…h2.ss-h.br-h` override
    (22px, then 19px) was **removed**: it was the main thing making the app
    differ.
  - The `.ss-panel:has(.br-h)` / `:has(.px-list)` padding overrides were
    **removed**; the prototype has no such rule, so the base `.ss-panel`
    padding (22/14/26) applies.
  - Rows: `.br-row` is a `150px / 1fr` grid, `gap 8px 16px`, `margin-top
    22px`, `padding-left 18px`; `.br-row.top` for the textarea row. Drop
    box / preview are 62px; `.br-drop small` is 6px. `.br-sec` is
    18px/500 (`margin-top 40px`); `.br-foot` 38px `.btn-dark`. `.px-row`
    is a 90px `40px / 1fr / auto` grid, `padding 16px 18px 16px 22px`; tint
    `#eef3f0`; `.px-in` is `22ch`/12.5px; `.px-save` 38px.
- **Branding** (`overview-screens.tsx`): favicon row is a plain `.br-row`
  (no `.fav`/`.seo` classes); the drop-box label reads "PNG, JPG, SVG or
  ICO"; a **Remove** button (`#br-fav-rm`, hidden until a favicon exists)
  sits next to the preview; SEO labels read "Default Meta Title:" /
  "Default Meta Description:" and the description row is `.br-row.top`.
  The 5 MB message is the prototype's exact "That image is over 5MB. Pick
  a smaller one."
- **Pixels** (`overview-screens.tsx`): the custom-code snippet is a
  `.px-snip` `<span>` containing `<code id="px-snip">` and a `.btn-text`
  toggle (`#px-code-toggle`) whose label is "Add script" / "Edit" /
  "Hide editor".

Verification: `pnpm typecheck` clean and production build clean; the
throwaway Playwright measurement spec (prototype vs fixture) reported an
exact match for all measured properties; temp spec/config/screenshots
removed after the run.

### Custom domain verification, product slide-in and the new-site wizard - 15 October 2026

Three more changes the owner made in `digital-romanian-screen.html` were
ported one-for-one.

- **Site Settings → Custom Domain** (`overview-screens.tsx`,
  `overview.css`, `overview.tsx`): the tab now shows a **pending domain**
  banner (`.ss-pend`) when a domain was entered but not verified. The
  **DNS dialog** was upgraded to the prototype's live version: per-field
  copy buttons (`.dns-fc`), a **Connection Status** section
  (`.dns-st`/`.dns-st-line`/`.dns-st-list`/`.dns-dot`) that walks
  wait → checking → "A found / CNAME missing" → verified (the prototype's
  two-try behaviour, with a comment marking it prototype-only), a
  `.dns-val` layout, and `#dns-back` hidden once verified. Closing without
  verifying leaves the domain pending; verifying clears it and toasts.
  `overview.tsx` gained a `pendingBySite` map threaded through
  `SettingsView` as `pendingDomain`/`onPending`. All new CSS added; the
  `.dm-*` mobile metrics were synced to the prototype (`height 48px`,
  `font-size 15px`, field radius 8px).
- **Add/Edit product dialog slides in from the right**
  (`overview-screens.tsx`, `overview.css`): the dialog carries
  `id="dlg-product"` and the exact `pd-in`/`pd-out`/`pd-fade` keyframes
  and reduced-motion guard from the prototype. A `closeAnimated()` helper
  plays `pd-out` before the native close on the X, backdrop click and Esc
  (`cancel`), and before handing off on submit; the StrictMode guard is
  unchanged.
- **Create a new website wizard** (new `routes/new-site.tsx`, registered
  in `routes.ts`; CSS in `digital-romanian.css`): the 3-step
  category → name → domain wizard from the prototype (9 categories,
  name suggestions, live `.digitalromanian.site` address hint, optional
  custom domain with the prototype's validation). `create-site` in
  `workspace-actions.server.ts` now accepts `siteName` and returns the new
  `siteId`. On launch the action redirects to
  `/overview?site=<id>[&domain=<host>]`; `overview.tsx` opens that site,
  seeds the pending domain and offers a "Set up DNS" toast, then strips the
  query. Every create entry point (`workspace-sites.tsx` header + grid
  tile, and the overview site switcher) now opens `/new-site`, matching the
  prototype's `[data-new-site]`/`[data-wiz-start]` handlers. The two
  "no site" empty states keep their prototype `/workspace` link.

Category → theme is not persisted: the applied `sites` table has no
theme/category column and the app already derives a display theme from the
site name (`themeForSite`), so the wizard's category only tailors the name
suggestions. The custom domain is likewise not written to `site_domains`;
it is carried client-side exactly like the rest of the ported domain UI.

Verification: `pnpm typecheck` clean and production build clean
(`new-site` chunk emitted). No DB migration; no hosted Supabase writes.

### Sidebar/page-label sync + wizard first step to the renamed prototype - 15 October 2026

The prototype was re-saved as `wp.html` at the repo root (it replaced
`digital-romanian-screen.html`, which no longer exists). Three further
owner edits in it were ported one-for-one:

- **Site Permissions tab removed** (`overview.tsx`): the sidebar's
  "Site Permissions" row is gone, and the `permissions` key was dropped
  from `NAV_LABELS`. `wp.html` has no "permission" text anywhere, which
  confirms it.
- **Pages relabel + row icons removed** (`overview.tsx`,
  `overview-screens.tsx`, CSS comment): "Website Pages" is now **Pages**
  everywhere the user can see it — the sidebar item, the pages screen
  `<h1>`, its `aria-label`, and the no-site empty-state title.
  `SITE_VIEW_TITLES.pages` is `"Pages"`. The per-row `.wic` icon was
  removed from the Pages table rows (products keep their `.pthumb`
  thumbnails; `.wic` CSS remains but is now dead, matching `wp.html`).
- **"Content/CMS" → "Content"** (`overview.tsx`): the sidebar item and
  `NAV_LABELS.cms` now read **Content**.
- **Wizard first step redesigned** (`new-site.tsx`, `digital-romanian.css`):
  step 1 is no longer the category *grid*; it is the prototype's
  `.wiz-about` block — a centered heading, an auto-growing
  `.wiz-desc` textarea (rows=1, maxlength=400) and a row of nine
  label-only `.wiz-chip` buttons — with a `.wiz-foot3` footer of
  **Back** (cancels to `/workspace`), **Skip** and **Continue**. Continue
  is disabled until a category is chosen or the description is non-empty;
  Skip/Continue guess a category from the description (`CAT_WORDS`/
  `guessCat`) and advance to the name step. CSS matches the prototype's
  block verbatim, including the mobile `.wiz-foot3`/`h1`/chip rules.

Code comments that still name `digital-romanian-screen.html` (and the
"Website Pages"/"Content/CMS" CSS section comments) were left as-is —
they are not user-visible and the file rename is noted here instead.

Verification: `pnpm --filter @digital-romanian/web typecheck` clean and
production build clean (root CSS emitted at 138.24 kB, up from 136.73 kB).
No DB migration; no hosted Supabase writes.

### Content view, Danger Zone and the rebuilt Analytics & Pixels panel - 15 October 2026

Three more `wp.html` surfaces ported one-for-one. All three stay
client-side, per-site state mirroring the prototype — no schema change, no
hosted writes.

- **Content** (`overview-screens.tsx`, `overview.tsx`, `overview.css`):
  new `ContentView` + `ArticleDialog` + `ArticleBodyDialog` +
  `ArticleSeoCard`/`ArticleSeoDialog`. The list is the prototype's
  `.acard`/`.arow` table (cover thumb, title/slug/snippet, author, date,
  status pill, per-row `MoreMenu` with view-live/unpublish/duplicate/
  delete) with search, a status filter and a `Pager`. The dialog carries
  the cover drop-box, title/slug (auto from title), author `AUTHOR_ROLES`,
  status, the `.ab-card` Content Body summary opening a
  `contentEditable` editor (`.ae-bar` toolbar: block style, B/I/U, lists,
  blockquote, link, image, clear formatting; live word count + excerpt
  auto-fill), and an "Edit SEO" sub-dialog (`.sx-*` accordion +
  `.ar-og` Google preview). New types `Article`/`ArticleSeo`,
  `generateArticles` seed (two prototype articles), and the `fmtDate`/
  `fmtTime`/`timeAgo` helpers. `overview.tsx` gained
  `articlesBySite`/`unpublishedBySite`/`removedSiteIds`, turned the inert
  `cms` nav into a real `/overview/content` link, and routes
  `SITE_VIEW_TITLES.content = "Content"`.
- **Danger Zone** (`overview-screens.tsx`, `overview.css`, `overview.tsx`):
  the `danger` tab no longer shows a placeholder — it renders the
  prototype's three `.sdz-card`s (unpublish, transfer ownership, delete
  site) plus `SiteDangerDialog` confirmations. Unpublish flips the site's
  status, transfer/delete mark the site removed and return to
  `/workspace`, and "create a workspace" reuses the existing wizard.
  `SS_SOON` is now unused.
- **Analytics & Pixels** (`overview-screens.tsx`, `overview.css`): the
  panel was rebuilt to the prototype's catalog model — a `PX_TOOLS`
  catalog (GA, Meta, TikTok, Google Ads, Snapchat, Pinterest, LinkedIn,
  X, GTM, Clarity, Hotjar, Search Console; grouped with brand marks) and a
  `pxDraftOf()` draft with unsaved-changes tracking. Each row is
  `.px-ic`/`.px-head` + Active/Paused chip/`.px-id` labelled input/
  `.px-acts` ("On" switch, Copy ID, remove). An in-list `.px-addrow`
  "Add tracking tool" opens the searchable, grouped `.pxa-*` picker
  (already-added tools disabled). A `.px-bar` carries the note,
  `Discard` and `Save Tracking Configuration`. `PX_CODE_ON = false` keeps
  the custom Header Code row hidden exactly as in the prototype;
  `generatePixels` seeds the flat `vals`/`on` shape.

Verification: `pnpm --filter @digital-romanian/web typecheck` clean and
`pnpm --filter @digital-romanian/web build` clean. Browser-verified via
Playwright against the local `e2e/support/feature-server.mjs` fixture (no
hosted services): a temporary spec signed in and confirmed the Content
list (5 header cols, 3 rows after adding an article, dialog + body editor
save), the Danger Zone (three cards + confirm dialog), and the Pixels
panel (ga/fb rows with switches + remove, the 12-tool/5-group picker,
add → 4 rows, switch toggle, remove → 3 rows, dirty note). Zero
console/page errors. The temp scripts/screenshots were removed after the
run, so no new committed e2e coverage exists (consistent with the rest of
the overview screens).

### Content, Danger Zone and editor/SEO CSS exact-match pass - 15 October 2026

Follow-up fidelity pass so the Content view, the article add/edit +
Content Body editor + SEO sub-dialogs, and the Danger Zone read
**rule-for-rule** identical to `wp.html`, not merely close.

- **Content list + editor + SEO CSS replaced one-for-one**
  (`overview.css`): the content block (`.acard-head`/`.acard-tools`/
  `.ofilter`/`.ofilter-btn`/`.arow` grid
  `minmax(0,300fr) 124fr 232fr 136fr 190fr`/`.arow.head`/`.athumb 68px`/
  `.atxt`/`.a-date span`/`.cpill.sched`/`.edit-btn`/`.ar-slug > span`, with
  the prototype's 1100/760/420 breakpoints) and the editor + SEO block
  (`.seo-dom`/`.seo-switch`, `.ae-*`, `.ar-og*`/`.seo-lr`, `.seo-stage`/
  `.seo-q`/`.seo-res`/`.seo-rt`/`.seo-rd`/`.seo-fields`, `.sx-*`, `.ab-*`,
  and the `.modal-abody` overrides) now carry the prototype's exact
  declarations in the prototype's order. Stale content-specific rules that
  had leaked into the generic `@media (max-width:760px)` block
  (`.arow`/`.arow.head`/`.a-author`/`.a-date`/`.acard-tools .sv-search`/
  `.acard-tools .sv-add`) were removed, leaving only
  `.modal-abody, .modal-pxadd { width: calc(100vw - 24px) }`.
- **Danger Zone rewritten one-for-one** (`overview.css`,
  `overview-screens.tsx`, `overview.tsx`): the `.sdz*` block now matches
  the prototype (`[data-route="/overview"] .ov .sdz-h` 22px, `.sdz-sub`,
  `.sdz-list { margin: 22px -14px -26px }`, `.sdz-row` grid
  `44px minmax(0,1fr) auto` min-height 102px, `.sdz-row.tint`, `.sdz-ic`,
  `.sdz-btn { width: 168px }` with `.ghost`/`.solid`/`.calm`, `.sdz-state`/
  `.live`, `.sd-name`, and the mobile rule). `DangerPanel` is
  `h2.sdz-h` + `p.sdz-sub` + a `.sdz-list` of three `.sdz-row`s, and
  `SiteDangerDialog` uses `.modal.modal-danger`, `.dh`/`.dh-ic`,
  `.dlist`, `.role-note`, `.tlist`/`.tempty`, `.confirm-label`/`#sd-confirm`
  and `.alert-error`. `overview.tsx` replaced `unpublishedBySite` with
  `publishOverrideBySite` and passes `status` + `onRepublish`/`onUnpublish`.
- **DOM ids restored to the prototype** (`overview-screens.tsx`): the
  Content dialog/editor/SEO controls (`ab-done`, `ar-submit`,
  `ar-seo-reset`, `ar-seo-save`, `ar-seo-open`, `ab-open-l`, `ae-link-ok`,
  `ae-link-x`, `ae-img`, `ar-count`, `ae-err`, `ar-img-bar`, `ar-img-err`,
  `ar-file`, `ar-img-replace`, `ar-img-remove`, `art-foot`) and the SEO
  sub-dialog fields (`agp-q/fav/sn/url/t/d/off`, `aseo-c-title`,
  `aseo-bar-title`, `aseo-c-meta`, `aseo-bar-meta`, `ar-sxv-slug`,
  `aseo-dom`, `ar-sxv-og`, `ar-og-use/own/pick/clear/file/img/dom/t/d`,
  `ar-sxv-index`, `ar-seo-index`), plus the dialog ids `dlg-abody`,
  `dlg-aseo`, `dlg-site-danger` and the danger-dialog ids `sd-ic`,
  `sd-word`, `sd-confirm-label`, `sd-error`, `sd-submit`. The broken
  Replace-image button (`#ar-file-btn` → `#ar-file`) was fixed. The
  transfer list now renders the prototype's `.wmark` avatar. `MoreMenu`
  gained a `wrapClassName` prop (default `"menu-anchor"`) so the Content
  filter wraps its trigger in `.ofilter` exactly as the prototype does.

Verification: `pnpm --filter @digital-romanian/web typecheck` clean and
production build clean. Re-run with Playwright against the same local
fixture: the temporary spec signed in, exercised the Content list + add
article + body editor + SEO dialog, then the Danger Zone (republish →
live, unpublish dialog with hidden confirm and enabled submit → offline,
transfer empty-state branch, delete dialog gated on the typed site name).
All assertions passed with zero console/page errors; the temp spec and
config were deleted afterwards.

### Content dialog image, danger-zone icon, switcher Back-to-workspace - 16 October 2026

Three small wp.html-parity fixes reported by the owner. Presentation only;
no schema change, no hosted writes.

- **Article edit dialog showed an empty cover** (`overview-screens.tsx`):
  `ArticleDialog`'s initial `img` state only fell back to `photo`, while
  the Content row renders `a.img || photoUrl(a.photo || ART_COVER)` — so
  editing a seeded article (img unset, photo set) showed the empty
  `.ar-thumb` drop box instead of the article's image. The init now
  mirrors the row (same pattern as `ProductDialog`):
  `edit ? edit.img || photoUrl(edit.photo || ART_COVER).replace("w=120&h=120", "w=280&h=280") : null`.
- **Danger-zone unpublish icon** (`overview-screens.tsx`): `SDZ_IC.ban`
  was the prototype's `up` glyph (20×20 `<use href="#i-publishing">`);
  it is now the exact circle-slash svg `wp.html` uses for the live /
  "Unpublish Site" row and the confirm dialog (24×24 path,
  `fill="currentColor"`). `up` (offline / "Republish Site") stays
  `i-publishing`, matching wp.html's `dangerPanel(s, d)` one-for-one.
- **Overview site switcher: Back to workspace row** (`overview.tsx`,
  `overview.css`): `SiteSwitcher` gained a `workspace?: WorkspaceRow`
  prop and now renders wp.html's `#sw-back` row as the first child of
  `.switcher-scroll` — `Link` to `/workspace`, the arrow glyph,
  `strong` "Back to workspace", the `#sw-back-ws` subtitle
  (`"{name} · all sites, team & settings"`, fallback
  "All your workspaces") and the `#sw-back-mark` Wmark avatar. `.sw-back*`
  CSS copied verbatim from wp.html (including its 760px rule). The call
  site passes `activeWorkspace`.

Verification: `pnpm --filter @digital-romanian/web typecheck` clean and
production build clean. A temporary Playwright spec against the local
`e2e/support/feature-server.mjs` fixture (no hosted services) passed 3/3:
the edit dialog's `#ar-thumb` renders the seeded article's image
(resolved `w=280&h=280`), `#sw-back` is visible with the workspace
subtitle and navigates to `/workspace`, and the danger-zone icon is the
i-publishing arrow while offline and the circle-slash after publishing.
Environmental note: Playwright's `webServer` spawn of the fixture timed
out twice this session with the plain `node e2e/support/feature-server.mjs`
command and booted when wrapped as
`cmd /d /s /c "node e2e/support/feature-server.mjs > log 2>&1"` — if that
happens again, check for orphaned listeners on 5188/5189 first before
concluding the fixture is broken. Temp spec/config/logs removed after the
run, so no new committed e2e coverage exists (consistent with the rest of
the overview screens).
