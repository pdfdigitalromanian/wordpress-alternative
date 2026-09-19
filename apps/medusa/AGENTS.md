# AGENTS.md

## Overview

Medusa v2 backend (`@medusajs/medusa` 2.21.0, Node 20+, PostgreSQL 16) for
Digital Romanian CMS. `create-medusa-app` normally generates its own
Turborepo monorepo (`apps/backend`, optional `apps/storefront`, its own
root `package.json`/`pnpm-workspace.yaml`); that nested monorepo was
**flattened** into this single directory during the M0 session so it fits
inside this repo's own root pnpm workspace (`apps/*`) without a nested
lockfile or a second Git repo. There is no storefront here — the
storefront lives in `apps/web` per `docs/architecture.md` at the repo
root, as ordinary React Router routes, not a Next.js app.

## Directory structure

```text
apps/medusa/
├── medusa-config.ts      # DB URL, Redis, CORS, secrets, worker mode
├── integration-tests/    # setup.js (Jest setupFiles) and http/*.spec.ts suites
└── src/
    ├── admin/            # Admin dashboard extensions (widgets/, i18n/, routes)
    ├── api/              # API routes: api/store/*, api/admin/* (file-based)
    ├── jobs/             # Scheduled jobs
    ├── links/            # Module links between modules
    ├── migration-scripts/# Data migration scripts (e.g. initial-data-seed.ts)
    ├── modules/          # Custom modules (service + models + migrations)
    ├── subscribers/      # Event subscribers
    └── workflows/        # Workflows and workflow steps
```

## Package manager

pnpm, pinned at the repo root (`pnpm@11.21.0` in the root `package.json`).
Run everything from here with `pnpm <script>`, or `pnpm --filter
@digital-romanian/medusa <script>` from the repo root. Never add a second
lockfile inside this directory.

## Commands

```bash
pnpm dev                          # http://localhost:9000, admin at /app
pnpm build
pnpm start                        # build first, then start
pnpm lint                         # medusa lint / @medusajs/eslint-plugin
pnpm test:unit
pnpm test:integration:modules
pnpm test:integration:http
```

Single test — pass a path/pattern through to Jest, keeping `TEST_TYPE`:

```bash
pnpm test:unit -- src/modules/foo/__tests__/service.unit.spec.ts
pnpm test:unit -- -t "returns the cart"
```

### Database

```bash
npx medusa db:generate <module-name>   # generate migrations for a custom module
npx medusa db:migrate                  # run migrations
npx medusa user -e <email> -p <password>
```

Local dev DB/Redis are native Homebrew services (no Docker on this
machine) — see the repo root `docs/setup.md` and
`scripts/check-local-services.sh` before assuming a connection failure is
a code bug.

## Medusa Skills & MCP Server

Optional but recommended — documentation-backed answers instead of guesses
about Medusa APIs.

**Agentic skills** ([docs](https://docs.medusajs.com/learn/introduction/build-with-llms-ai/agentic-skills)) —
if the `medusa-dev` skills are listed as available, load them *before*
writing code:

- `building-with-medusa` — any backend work: modules, API routes,
  workflows, data models, module links
- `building-admin-dashboard-customizations` — anything under `src/admin`
- `db-generate` / `db-migrate` / `new-user` — the DB and user commands above

If not installed, suggest:

```bash
/plugin marketplace add medusajs/medusa-agent-skills
/plugin install medusa-dev@medusa
```

**MCP server** ([docs](https://docs.medusajs.com/learn/introduction/build-with-llms-ai/mcp-server)) —
a `medusa` MCP server exposing the official docs. Prefer it over web
search or memory for any Medusa API, config, or upgrade question:

```bash
claude mcp add --transport http medusa https://docs.medusajs.com/mcp
```

## Code style

- **Must satisfy `@medusajs/eslint-plugin`'s recommended config**
  (`eslint.config.ts`). Its rules encode Medusa framework requirements —
  correct route/workflow/module shapes, not just cosmetics — so a lint
  failure usually means the code is actually wrong. Never disable a
  `@medusajs/*` rule to make lint pass; fix the code.
- No semicolons. Double quotes, 2-space indent.
- Files: kebab-case. Types/classes: PascalCase. Functions/variables:
  camelCase. DB columns: snake_case.
- No emojis in code, comments, or commit messages.

## Conventions

- **Routing is file-based.** A store endpoint is
  `src/api/store/<path>/route.ts` exporting `GET`/`POST`/etc. Don't add a
  router or register routes manually.
- **Business logic belongs in workflows**, not in route handlers. Routes
  resolve and run a workflow; workflows compose steps.
- This CMS never writes directly to Medusa's tables from `apps/web` or
  from Supabase — see the "Data ownership boundary" section of the repo
  root `docs/architecture.md`. Any CMS-side reference to Medusa data
  (product IDs, etc.) goes through the typed server boundary described
  there, not raw SQL or a shared client.

## Common mistakes

- Assuming Docker or `docker-compose` exist in this repo for local
  Postgres/Redis — they don't; see `docs/setup.md`.
- Editing a custom module's model without running
  `npx medusa db:generate <module>` — the migration is missing and the
  change silently never applies.
- Writing raw SQL or importing DB clients directly instead of going
  through module services / workflows.
- Running the test task without a reachable PostgreSQL — integration
  suites need a live DB (`./scripts/check-local-services.sh` from repo
  root checks this).
- Silencing `@medusajs/*` ESLint rules instead of fixing the underlying
  pattern.
- Running `db:migrate` (with its bundled demo seed script) against a
  shared/staging/production database without checking
  `src/migration-scripts/initial-data-seed.ts` first — it inserts demo
  region/sales-channel/product data, meant for local verification only.

## Off-limits

- `.medusa/`, `dist/`, `build/` — build output, regenerated.
- The repo root's `pnpm-lock.yaml` — never hand-edit or delete; change it
  only as a side effect of a package manager command.
- `.env` — never commit, print, or copy secret values out of it. Edit
  `.env.template` instead when documenting a new variable.
- Existing migrations in `src/modules/*/migrations/` — add a new
  migration rather than rewriting one that may already have run.
- Don't run destructive DB commands (drops, resets) against any database
  other than the local `medusa` one without explicit confirmation.
