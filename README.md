# Digital Romanian CMS

A React Router (Framework Mode, SSR) + Vite WordPress alternative with a
blank-theme visual builder (Puck), real server-rendered publishing, and an
optional Medusa v2 commerce module per site.

- `apps/web` — CMS admin, visual editor, public SSR renderer. Deploys to
  Vercel.
- `apps/medusa` — Medusa v2 commerce backend. Deploys separately to a
  persistent Node host (not Vercel).
- `supabase/` — CMS database migrations (owns workspaces, sites, content,
  publishing; never Medusa's product/order tables).

See `docs/architecture.md` for the full design, `docs/setup.md` for local
development, and `docs/implementation-plan.md` for the milestone map.

## Quick start

```bash
pnpm install
pnpm --filter @digital-romanian/web dev      # http://localhost:5173
pnpm --filter @digital-romanian/medusa dev   # http://localhost:9000
./scripts/check-local-services.sh            # sanity-check local Postgres/Redis
```

This environment has no Docker; local Postgres/Redis for Medusa run as
native Homebrew services, and the CMS develops directly against the
linked hosted Supabase project. Details in `docs/setup.md`.
