# Implementation plan

Maps every requirement from the product brief (Part A: original CMS spec;
Part B: Medusa commerce extension + execution contract) to a milestone.
Part B's milestone sequence (§26) replaces Part A's milestone ordering
(§14), not its feature requirements — nothing here drops an original
requirement because commerce was added.

> The brief that produced this plan was delivered as a single very long
> message and was cut off mid-sentence during **M1** in §26 (source
> truncated at "Implement Supaba..."). M0 below reflects the brief's
> explicit M0 description. M1 onward is this plan's own synthesis,
> combining Part A §14's five milestones with Part B's commerce additions,
> following the same ordering logic (auth/ownership → editor/publishing →
> content/media/forms → integrations/SEO/domains → 3D/hardening), plus
> Part B's commerce milestones layered alongside. **That M1-onward
> synthesis is this plan's own reconstruction, not the original brief —**
> and it got the priority wrong: it put storefront/checkout in M5, after
> generic content/media/forms in M3. An explicit work order (2026-09-20,
> reviewing commit `b5ded70`) corrected this: a usable storefront (catalog
> + persistent cart) comes before expanding generic CMS content features
> or rebuilding native Medusa Admin screens. **`docs/progress.md` is the
> current source of truth for what's actually built and what's next** —
> the milestone labels below are kept for traceability to the original
> requirement numbering, not as the authoritative sequence anymore.

## M0 — Repository and local infrastructure — **done** (2026-09-19)

- [x] Inspected checkout (was empty, not a git repo).
- [x] `git init`.
- [x] pnpm workspace: `apps/web`, `apps/medusa` (packages/* added when a
      real consumer exists — see note below).
- [x] `apps/web`: React Router (Framework Mode, `ssr: true`) + Vite,
      `@vercel/react-router` preset wired in `react-router.config.ts`.
      Typechecks clean, `pnpm build` succeeds, `pnpm dev` verified to
      return real server-rendered HTML (title, meta description, content
      in the initial response — not an SPA shell).
- [x] `apps/medusa`: scaffolded via `create-medusa-app` (which generates
      its own nested monorepo — flattened into a single package per Part B
      §16's explicit warning about this). Depends on `@medusajs/*` 2.21.0
      packages; no upstream framework code vendored.
- [x] Local infra **adapted for no-Docker** (see `docs/architecture.md` §
      "Local database strategy" and `docs/setup.md`): native Homebrew
      Postgres 16 + Redis for Medusa; hosted Supabase project linked
      directly for the CMS (no local Supabase stack, since `supabase
      start` requires Docker).
- [x] Medusa migrations run against the local `medusa` database, admin
      user created, dev server verified healthy (`/health` → `OK`, `/app`
      → 200, `/store/products` → 400 without a publishable key, not a
      crash).
- [x] `.env.example` (`apps/web`) / `.env.template` (`apps/medusa`)
      written per Part B §25's variable contract.
- [x] `docs/architecture.md`, `docs/setup.md`, this file.
- [x] Hosted Supabase project **not** touched (no migrations pushed yet —
      `supabase/migrations/` is empty; `supabase link` needs your
      interactive `supabase login` first).

Known gaps carried forward: Node v24 vs. Medusa's documented Node 20/22
range (unverified, not reverted per your instruction); no production
deploy target chosen for `apps/medusa` yet; Medusa's bundled demo seed
data exists in the *local* database only.

## M1 — CMS ownership, auth, and a real public route

Part A §2 (admin shell only, not full admin areas), §3 (workspaces/sites,
roles, RLS), §14 milestone 1.

- [x] Schema + migrations: `workspaces`, `workspace_memberships` (roles:
      owner/administrator/editor/viewer), `sites`, `site_domains`, pushed
      to the hosted project via `supabase db push`
      (`supabase/migrations/20260920045632_initial_workspaces_sites.sql`).
- [x] RLS policies written in the same migration as the tables, not
      bolted on later.
- [x] Cross-workspace isolation verified with a real integration test
      against the hosted project (`supabase/tests/workspace-isolation.mjs`,
      run via `pnpm test:rls`) — two throwaway users, 9 checks, all
      passing: creation, auto-owner-membership, and denied cross-
      workspace read/insert/update.
- [ ] Supabase Auth wiring in `apps/web` (session handling, server-only
      secret key usage per Part A §11).
- [ ] Minimal admin shell (sidebar, site switcher, breadcrumbs — Overview
      area only; the other 13 admin areas in Part A §2's table come with
      the milestones that give them real data, not before).
- [ ] One real public SSR route resolved through a verified site/domain
      mapping (Part A §13's "reject unknown hosts" requirement; the
      `site_domains` table + `public_site_by_hostname` view already exist
      for this), replacing the placeholder `/` route from M0.

Note: reaching the schema milestone surfaced a real Postgres RLS
gotcha — worth knowing before writing similar trigger-driven ownership
patterns elsewhere (collections, forms, etc.): AFTER ROW triggers fire at
the end of the statement, which is *after* an `INSERT ... RETURNING`
projection is computed. A `workspaces_select` policy that depended solely
on the owner-membership row created by an `AFTER INSERT` trigger failed
on the creator's own `INSERT ... RETURNING` — Postgres treats "can't see
the row you just inserted" as the same RLS violation as a failed
`WITH CHECK`. Fixed by also allowing `created_by = auth.uid()` directly
in the select policy (see
`supabase/migrations/20260920050413_fix_workspaces_select_visibility.sql`
for the full explanation) rather than depending on trigger timing.

## M2 — Blank theme, visual editor, publishing, rollback

Part A §4 (blank theme + design tokens), §5 (Puck-based editor), §10
(publish/release/rollback model).

- [x] Schema: `pages` (draft_document), `releases`/`release_pages`
      (immutable snapshots), `sites.active_release_id`, and the
      `publish_site()`/`rollback_site()` RPCs (SECURITY DEFINER, own
      role check, atomic) —
      `supabase/migrations/20260920155805_pages_releases_publishing.sql`.
      Bug found and fixed by `supabase/tests/publish-rollback.mjs`
      (`pnpm test:publish`, 18/18 passing): a NULL workspace role (non-
      member) silently passed PL/pgSQL's `IF ... THEN raise` check.
- [x] Component registry (`apps/web/app/lib/component-registry/config.tsx`,
      not a separate `packages/` workspace package — nothing else
      consumes it yet, so the extra tooling would be premature; promoting
      it is a mechanical follow-up if that changes): Section (slot),
      Heading, Text, Button. Shared verbatim between editor and renderer.
- [x] Puck integration (`@puckeditor/core`, not the deprecated
      `@measured/puck`) at `/admin/sites/:siteId/pages/:pageId`: canvas +
      autosave via debounced fetcher with optimistic-concurrency conflict
      detection. Inspector is Puck's own generated field UI for now
      (Content-equivalent only) — the full Content/Layout/Style/
      Responsive/Advanced split from Part A SS5 is a later refinement once
      there are enough component fields to organize.
- [x] Draft vs. published separation: `/admin/sites/:siteId` has Publish
      (creates an immutable release, atomically moves the pointer) and
      release history with per-release rollback.
- [x] Editor bundle kept out of public renderer bundle — verified in the
      built output, not assumed: importing `Render` from the main
      `@puckeditor/core` entry pulled the ~455KB drag-and-drop editor
      (dnd-kit, ActionBar, Drawer) into the public route via shared
      chunking; switched the public route to the dedicated `rsc` entry
      point, public chunk is now ~17KB with zero editor-chrome strings.
- [x] `routes/site-page.tsx` (replacing the M1 placeholder) resolves
      host -> site -> active release -> page-by-path and server-renders
      the real published Puck document.
- [ ] Responsive (desktop/tablet/mobile) style overrides, layer
      navigator, copy/paste, keyboard shortcuts, reusable/global
      components, revision history beyond releases — not yet built.
      Puck's own drag/reorder/undo-redo and inline editing come from the
      library itself and were not re-verified interaction-by-interaction
      (only autosave/publish/rollback were driven programmatically; the
      canvas UX itself needs a real browser pass).

## M3 (reprioritized) — Store connection + a working catalog and cart

Originally split across M4/M5 below; pulled forward by the 2026-09-20 work
order ahead of generic content/media/forms (Part A §8/§12, now M4). Part B
§18 (commerce_connections registry), §19 (Setup/status + Products rows of
the Store table — the rest of that table is deferred, not built), §20
(server boundary), §21 (first commerce Puck component), §22 (catalog +
cart specifically — checkout/payment is the *next* milestone, not this
one).

- [x] `commerce_connections` (Part B §18): one connection per site,
      encrypted secret key (AES-256-GCM, site+provider identity bound
      into the AAD), RLS scoped to owner/administrator.
      `supabase/migrations/20260920172727_commerce_connections.sql`.
- [x] Server boundary (`apps/web/app/lib/medusa.server.ts`): Admin API
      (secret key, HTTP Basic auth — verified against a live instance;
      Bearer gets a 401 naming Basic as required) and Store API
      (publishable key, `x-publishable-api-key` header) as separate
      surfaces, never mixed. SSRF guard: operator allowlist
      (`COMMERCE_ALLOWED_BACKEND_ORIGINS`) checked first, a
      production-gated localhost exception, embedded-credential
      rejection, no redirect-following, and the connection pinned to a
      once-resolved, validated IP (closes a DNS-rebinding TOCTOU gap).
      9 regression tests (`pnpm test` in `apps/web`) — one caught a real
      bug (a private-IP-in-dev check that wrongly admitted any RFC1918
      address, not just localhost) before it shipped.
      Responses validated with zod into explicit DTOs, not `as` casts.
- [x] `/admin/sites/:siteId/store`: save/test/remove connection, masked
      key display, four distinct honest failure reasons (unauthorized /
      unreachable / SSRF-blocked / unsupported) — verified all four
      live. `/admin/sites/:siteId/store/products`: real product list.
      Native Medusa Admin link/full parity (inventory, orders, customers,
      promotions, shipping/regions, presentation) — **deferred, not
      built**; see Part B §19's explicit interim-delivery note.
- [x] `lib/commerce.server.ts`: the storefront adapter.
      `resolveStorefront()` distinguishes no-connection / no-publishable-
      key / connection-not-tested / no-region rather than treating any
      200 as ready. `resolveCart()` gets-or-creates a real Medusa cart
      via a signed, HttpOnly, site-scoped cookie holding only the opaque
      cart ID.
- [x] `/shop`, `/products/:handle`, `/cart` — reserved commerce routes
      ahead of the CMS catch-all. Real product data, Medusa-computed
      totals (never trusts browser-submitted amounts), honest
      out-of-stock/insufficient-inventory messaging (verified live by
      temporarily setting real stock to 1 via the Admin API and
      confirming the rejection through the actual route, then
      restoring it), 404 for unknown handles, cart persists across
      reload and is isolated per browser session.
- [x] `ProductGrid` — first commerce Puck component
      (`component-registry/config.tsx`). Its `resolveData` fetches an
      isomorphic API route (`api.storefront-products.tsx`) rather than
      importing `medusa.server.ts` directly, since Puck runs
      `resolveData` in the *browser* during live editor preview, where
      `node:dns`/`undici` don't exist. `resolveAllData` resolves it
      server-side, fresh per request from the stored *unresolved*
      document, before `<Render>` — verified a live Medusa price change
      shows up on next page view without republishing the CMS release
      (i.e. publish/rollback genuinely never touch Medusa state, in
      either direction).
- [ ] Category/collection **picker UI** for ProductGrid — currently a
      plain category-ID text field, not a picker. Multi-region stores —
      only a single-region store has been tested; `resolveStorefront`
      currently takes the first region, documented as a visible
      simplification.
- [ ] Guest checkout, shipping/payment, order confirmation — explicitly
      the *next* milestone (Part B §6), not started.

## M4 — Content, media, navigation, forms, SEO, domains, integrations

Part A §8 (posts/collections/templates), §9 (SEO/sitemap/redirects), §11
(non-commerce integrations), §12 (media/forms/navigation), §13 (domain
verification).

- Collections with typed fields, relationships, schema migration path.
- Media library (Supabase Storage): folders, metadata, alt text, usage
  references, upload validation (no unsafe SVG/HTML execution).
- Forms: definitions, submissions persisted server-side, notification
  delivery tracked separately from submission storage, rate limiting.
- Navigation: nested menus, page-ID references that survive slug changes.
- SEO: metadata, canonicals from verified domains, sitemap/robots,
  structured data, redirect management with loop detection. Extends to
  product/catalog pages once M3's storefront work is further along.
- Real DNS domain verification (the current "Mark verified" button in
  `/admin` is an explicit manual placeholder, labeled as such — not real
  DNS record checking).
- Integrations area for non-commerce providers (email, analytics).

## M5 — Guest checkout and the first verified test order

Part B §6. Guest checkout, configured region/address/shipping selection,
a supported payment provider in TEST mode, webhook signature verification,
retry-safe completion via supported Medusa workflows, protected order
confirmation, confirming the order appears in native Medusa Admin. No real
charges, notifications, or fulfillment during tests.

## M6 — Three.js, responsive refinement, production hardening

Part A §7 (Three.js components), §14 milestone 5 (responsive editor
refinements, exports). Part B §23/§24 (events/webhooks/file provider for
commerce specifically, beyond what M5 needs for checkout), remaining Store
table rows if a concrete workflow needs them (Part B §19's explicit
interim-delivery note — not automatic).

- Three.js scene component with typed props, lazy-loaded only on pages
  that use it, reduced-motion/WebGL-failure handling.
- Full Content/Layout/Style/Responsive/Advanced inspector split, layer
  navigator, reusable/global components (Part A §5 refinements deferred
  from M2).
- Production hardening: a chosen `apps/medusa` production host,
  server/worker split, environment separation, monitoring.

## Acceptance flow (Part A §14, unchanged)

Owner signs in → creates a blank site → adds a page → builds it visually →
responsive style overrides → uploads an image → adds a configured Three.js
component → sets SEO → saves draft → previews privately → publishes.
Visitor gets published content+metadata in initial HTML. Owner edits a new
draft without affecting the live page, publishes it, rolls back to the
previous release. Cross-workspace access is verified denied. Public
bundles contain no private keys. Pages without 3D don't download 3D deps.
This flow is the exit test for the milestones above, run against the
deployed Vercel app plus the chosen Medusa host, not just locally.
