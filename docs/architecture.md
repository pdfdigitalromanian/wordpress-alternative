# Architecture

Digital Romanian CMS: a React Router (Framework Mode, SSR) + Vite application
for content/site management with a Puck-based visual editor, backed by
Supabase (Postgres, Auth, Storage), with an optional Medusa v2 commerce
module per site. Deployed as: `apps/web` on Vercel, `apps/medusa` on a
persistent Node host (not Vercel Functions).

## Monorepo layout

```
apps/
  web/        React Router (Framework Mode, ssr:true) + Vite. CMS admin,
              Puck editor, public SSR renderer, storefront routes.
              Deployed to Vercel via @vercel/react-router preset.
  medusa/     Medusa v2 backend: its own Admin, modules, workflows,
              providers. Deployed separately to a persistent Node host.
packages/
  ui/                  Shared UI primitives (admin + public, tree-shaken).
  component-registry/  Typed component definitions shared by editor and
                        public renderer. Editor-only fields import
                        separately so public bundles stay clean.
  commerce/             Server-side Medusa SDK adapters + typed contracts.
                        Public exports contain no admin credentials.
  shared/              Small cross-cutting utilities/schemas (zod, etc).
supabase/
  migrations/          CMS-owned SQL migrations (workspaces, sites, pages,
                        content, RLS policies, commerce_connections, etc).
  tests/               RLS / authorization / publishing test fixtures.
infra/                 Deployment + local service configuration.
scripts/               Setup checks and repeatable verification scripts.
docs/                  This file, implementation plan, setup, deployment.
```

## Why two apps instead of one

Medusa v2 is a stateful backend with its own worker mode, background jobs,
admin UI, and database migrations. It cannot run as a Vercel Function
(long-running process, its own Postgres, Redis-backed queues/locks). The CMS
public site and admin must be server-rendered on every request and deploy
independently on Vercel. Splitting them into `apps/web` and `apps/medusa`
keeps each on the hosting model it actually needs, per Part B §15-16 of the
product brief.

## Data ownership boundary

- **Supabase** (project `nsfcmwlbippjjlpvjoyd`, hosted; local dev uses a
  linked connection to the same project — see "Local database strategy"
  below) owns: workspaces, memberships, sites, domains, pages, content
  collections, Puck documents, revisions/releases, themes, navigation,
  forms/submissions, CMS media metadata, SEO overrides, encrypted
  integration credentials, audit events, and the `commerce_connections` /
  `commerce_presentations` / `commerce_event_receipts` registry described
  in Part B §18.
- **Medusa** (one isolated installation + Postgres database per
  commerce-enabled site) owns: products, variants, categories, collections,
  pricing, inventory, customers, carts, checkout, promotions, shipping,
  taxes, payments, orders, returns.
- The CMS never writes directly to Medusa's tables and never exposes them
  through Supabase's Data API. Medusa never becomes a second CMS content
  store. Cross-system operations (e.g. "record a successful Medusa order
  next to a CMS presentation") are reconciled explicitly, not wrapped in a
  single database transaction — see Part B §17, §23.

## Local database strategy (adapted from the original brief)

The original brief specified `supabase start` (a Docker-based local stack:
Postgres, GoTrue, PostgREST, Storage, Realtime, Studio) for local CMS
development. **This environment has no Docker and will not get one**, so
that path is unavailable. Adapted approach, agreed with the project owner
on 2026-09-19:

- **CMS**: developed directly against the hosted Supabase project via
  `supabase link` + versioned migrations pushed with `supabase db push`.
  There is no separate local CMS Postgres. This trades the original
  "never touch the hosted project before go-live" caution for the only
  Postgres actually available in this environment; it raises the bar on
  migration discipline instead (see `docs/setup.md` — every migration is
  additive/reviewed before push, RLS is written alongside every table from
  the first migration, no `supabase db reset` against the linked project).
- **Medusa**: uses a dedicated **native Homebrew Postgres 16** role/database
  (`medusa` / `medusa`) and a native Homebrew **Redis**, both already
  running as `brew services` on this machine — not Docker containers. This
  satisfies the "dedicated Postgres per Medusa installation" requirement
  (Part B §17) without Docker. See `docs/setup.md` for exact commands.
- Production still uses managed Postgres/Redis for Medusa (a real host, not
  this machine) and the hosted Supabase project for the CMS, per Part B §16.

## Rendering and bundle boundaries

- `apps/web` uses `ssr: true` and the `@vercel/react-router` preset
  (`react-router.config.ts`). Public routes must render meaningful HTML
  server-side (Part A §9).
- Editor-only code (Puck, drag/drop, inspector controls) must not ship in
  the public site bundle. Commerce editor controls (privileged product
  search) must not ship in the public storefront bundle either (Part B
  §21). This is enforced by keeping editor-only imports in separate
  route/module boundaries within `component-registry` and `commerce`, not
  by convention alone — bundle checks are added as this is implemented.
- Pages without a Three.js component must not download Three.js/R3F.

## Status

This file currently reflects the M0 (repository + local infrastructure)
milestone. It will be extended as auth, RLS, the editor, and commerce are
implemented — see `docs/implementation-plan.md` for the milestone map and
`docs/setup.md` for exact local commands.
