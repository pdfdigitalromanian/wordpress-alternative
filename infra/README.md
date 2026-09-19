# infra

Deployment configuration lives here as it's built out:

- A production container/deploy config for `apps/medusa` (it needs a
  persistent Node host, not Vercel — see `docs/architecture.md`). Not yet
  added; will be a later milestone once a target host is chosen.
- Any provider-specific config for managed Postgres/Redis used by Medusa in
  production.

This machine has no Docker, so there is no local `docker-compose` here.
Local Medusa dev uses native Homebrew Postgres/Redis instead — see
`docs/setup.md`.
