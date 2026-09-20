# CLAUDE.md

## What this is

An ecommerce website builder: **Medusa** supplies commerce (products,
pricing, inventory, carts, orders), the **React/Vite CMS** (`apps/web`)
supplies editable storefront presentation, pages, themes and publishing.
The goal is a usable storefront (owner publishes product-backed pages,
visitor browses and carts), not a rebuild of Medusa Admin inside the CMS.

## Stack (do not change without explicit approval)

React, TypeScript, Vite, React Router Framework Mode with SSR, Supabase
(Postgres/Auth), Puck (`@puckeditor/core` — the maintained fork; not the
deprecated `@measured/puck`), Vercel for `apps/web`. `apps/medusa` is a
separate Medusa v2 backend with its own database, deployed independently
(not Vercel Functions). pnpm workspace, one lockfile at the root. No
Next.js migration, no repo re-scaffold, no framework fork.

## Authoritative documents — read before making architectural decisions

- `docs/architecture.md` — data ownership boundary, monorepo layout, local
  dev adaptation (no Docker in this environment).
- `docs/implementation-plan.md` — milestone map. **Read the note at its
  top**: the original brief was truncated mid-M1 when first received: M1
  and M2 checkboxes are accurate (verified against real code/tests); M3+
  was this project's own reconstruction and has since been **reprioritized
  by an explicit work order toward storefront/cart before generic CMS
  content features** — treat `docs/progress.md` as the current source of
  truth for what's actually next, not the milestone numbering.
- `docs/progress.md` — actual state, verification results, blockers, next
  action. Update this before ending a session, not just when asked.
- `apps/medusa/AGENTS.md` — flattened-monorepo history, pnpm build-script
  allowlist gotcha, Medusa-specific commands.

## Verified commands

```bash
pnpm install
pnpm dev                       # apps/web, http://localhost:5173
pnpm --filter @digital-romanian/medusa dev   # apps/medusa, http://localhost:9000
pnpm typecheck
pnpm --filter @digital-romanian/web build
./scripts/check-local-services.sh
pnpm test:rls                  # cross-workspace RLS isolation (hosted DB)
pnpm test:publish              # publish/rollback RPC role checks (hosted DB)
```

No Docker in this environment (confirmed permanent). Medusa's Postgres/
Redis are native Homebrew services, not containers — see `docs/setup.md`.

## Data ownership (do not blur this line)

Medusa is authoritative for products, variants, pricing, inventory, carts,
customers, payments, orders, fulfillment. Never recreate these in
Supabase, never query Medusa's Postgres database directly for commerce
operations — always through Medusa's Store/Admin APIs. Supabase is
authoritative for CMS staff access, workspace/site ownership, content,
Puck layout documents, and releases. A CMS release may reference a
product by stable ID; it never carries authoritative price or stock.

## Safety rules

- **No hosted Supabase destructive operations without explicit, named
  authorization.** The project is currently developed directly against
  the hosted project (`nsfcmwlbippjjlpvjoyd`) because this environment has
  no local Postgres for the CMS (see `docs/setup.md`) — that makes
  "explicit authorization" the operative control, not "use a separate
  environment first." Migrations are additive and reviewed before
  `supabase db push`. Never run `supabase db reset` against the linked
  project. Test fixtures created for verification are cleaned up in the
  same session unless the user says to keep them.
- **Never print, log, or commit a real secret value** (API keys, JWTs,
  passwords) — mask before displaying, even in terminal output during
  testing. If a real secret was exposed in a transcript or terminal
  output, treat it as needing rotation and say so without redisplaying it.
- **Admin API credentials stay server-only.** Storefront/public code paths
  use Medusa's Store API with a publishable key, never the secret Admin
  API key.
- **SSRF-guard the Medusa backend URL field** — it's operator/owner input,
  not a hardcoded value. See `apps/web/app/lib/medusa.server.ts`.
- **Publishing a CMS release never touches Medusa state** (prices, stock,
  orders), and rolling a release back never touches it either.
- No browser-automation tool is available in this environment. HTTP-level
  and SSR-output verification substitutes for it; a real click-through is
  named as a blocked verification, not silently skipped.
