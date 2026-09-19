#!/usr/bin/env bash
# Repeatable local-environment health check for Digital Romanian CMS.
# This machine has no Docker; apps/medusa's Postgres/Redis run as native
# Homebrew services instead (see docs/setup.md). Run this before `pnpm dev`
# in apps/medusa to catch a stopped service early instead of via a cryptic
# ECONNREFUSED from the Medusa boot sequence.
set -euo pipefail

status=0

echo "== Postgres (medusa role/db) =="
if psql -U medusa -h localhost -d medusa -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "OK: connected as medusa to database 'medusa'"
else
  echo "FAIL: cannot connect as role 'medusa' to database 'medusa' on localhost:5432"
  echo "      try: brew services start postgresql@16"
  status=1
fi

echo
echo "== Redis =="
if redis-cli ping 2>/dev/null | grep -q PONG; then
  echo "OK: redis-cli ping -> PONG"
else
  echo "FAIL: redis not responding on default port 6379"
  echo "      try: brew services start redis"
  status=1
fi

echo
echo "== Medusa backend (if running) =="
if curl -sf http://localhost:9000/health >/dev/null 2>&1; then
  echo "OK: http://localhost:9000/health -> 200"
else
  echo "SKIP: not running (start with: pnpm --filter @digital-romanian/medusa dev)"
fi

echo
echo "== Web app (if running) =="
if curl -sf http://localhost:5173/ >/dev/null 2>&1; then
  echo "OK: http://localhost:5173/ responded"
else
  echo "SKIP: not running (start with: pnpm --filter @digital-romanian/web dev)"
fi

exit $status
