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
> Part B's commerce milestones layered alongside. Treat M1+ as a proposed
> plan to confirm/adjust, not a verbatim reproduction of unseen text.

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

## M3 — Content, media, navigation, forms

Part A §8 (posts/collections/templates), §12 (media/forms/navigation).

- Collections with typed fields, relationships, schema migration path.
- Media library (Supabase Storage): folders, metadata, alt text, usage
  references, upload validation (no unsafe SVG/HTML execution).
- Forms: definitions, submissions persisted server-side, notification
  delivery tracked separately from submission storage, rate limiting.
- Navigation: nested menus, page-ID references that survive slug changes.

## M4 — Integrations, SEO, domains — and Store setup/status + product editor

Part A §9 (SEO/sitemap/redirects), §11 (integrations/credentials), §13
(domains). Part B §19 ("Setup/status" and "Products" rows of the Store
area only — the rest of that table follows in M5), §20 (server boundary to
Medusa Admin), §25 (bootstrap contract).

- SEO: metadata, canonicals from verified domains, sitemap/robots,
  structured data, redirect management with loop detection.
- Integrations area: encrypted per-site credentials, masked-after-save,
  one working email provider adapter.
- Domain verification (real DNS status, not a green checkmark on save).
- Medusa side: `commerce_connections` registry (Part B §18), SSRF-guarded
  connection testing, typed allowlisted server handlers (no open proxy to
  Medusa Admin), Store → Setup/status and Products screens wired to real
  Medusa APIs.

## M5 — Three.js, commerce depth, responsive refinement, hardening

Part A §7 (Three.js components), §14 milestone 5. Part B §19 (remaining
Store area rows: inventory, orders, customers, promotions, shipping/
regions, presentation), §21 (commerce editor components), §22 (storefront/
checkout), §23 (CMS/commerce publishing separation), §24 (events/webhooks/
file provider).

- Three.js scene component with typed props, lazy-loaded only on pages
  that use it, reduced-motion/WebGL-failure handling.
- Commerce Puck components (product grid/card, variant selector, cart,
  checkout layout) with editor/public data separation.
- Guest checkout with a real (test-mode) payment provider, idempotent
  order completion, webhook handling.
- Production hardening: bundle checks (no 3D on non-3D pages, no secrets
  in client bundles), a chosen `apps/medusa` production host, security/
  authorization test pass across both systems.

## Acceptance flow (Part A §14, unchanged)

Owner signs in → creates a blank site → adds a page → builds it visually →
responsive style overrides → uploads an image → adds a configured Three.js
component → sets SEO → saves draft → previews privately → publishes.
Visitor gets published content+metadata in initial HTML. Owner edits a new
draft without affecting the live page, publishes it, rolls back to the
previous release. Cross-workspace access is verified denied. Public
bundles contain no private keys. Pages without 3D don't download 3D deps.
This flow is the milestone-5 exit test, run against the deployed Vercel
app plus the chosen Medusa host, not just locally.
