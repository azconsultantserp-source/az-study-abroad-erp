#!/usr/bin/env bash
# First-time VPS setup: env -> TLS -> deploy -> seed staff + document requirements.
set -euo pipefail

if [ ! -f .env ]; then
  echo "==> Creating .env"
  bash deploy/setup-env.sh
fi

# shellcheck disable=SC1091
source .env

# Auth URL is https://DOMAIN — extract domain for nginx placeholders / TLS bootstrap.
DOMAIN="$(echo "${AUTH_URL:-}" | sed -E 's#https?://##' | cut -d/ -f1)"
if [ -n "$DOMAIN" ]; then
  echo "==> Ensuring temporary TLS certs exist for ${DOMAIN} (Nginx needs them to start)"
  bash deploy/bootstrap-ssl.sh "$DOMAIN"
fi

echo "==> Starting Postgres first"
docker compose --profile deploy up -d postgres
echo "==> Waiting for Postgres..."
sleep 10

echo "==> Applying schema"
docker compose --profile migrate run --rm migrate

echo "==> Seeding staff accounts"
docker compose --profile deploy run --rm --entrypoint "" migrate \
  npx tsx prisma/seed.ts

echo "==> Seeding document requirements (588 rows)"
docker compose --profile deploy run --rm --entrypoint "" migrate \
  npx tsx prisma/seed-requirements.ts

echo "==> Full deploy (app + nginx + backup)"
bash deploy/deploy.sh

echo ""
echo "==> First-run complete."
echo "    Admin login: managingdirector@azconsultants.com / azc@2026"
echo "    Change passwords immediately in User Management."
