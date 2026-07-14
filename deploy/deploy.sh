#!/usr/bin/env bash
# One-command deploy on the VPS (Docker Compose path).
# Run from the project root after `git pull`.
set -euo pipefail

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building & starting stack (migrate -> app -> nginx)"
docker compose --profile deploy up -d --build

echo "==> Ensuring nightly backups are running"
docker compose --profile backup up -d

echo "==> Pruning old images"
docker image prune -f

echo "==> Waiting for health"
sleep 8
if curl -fsS http://127.0.0.1/api/health >/dev/null 2>&1 || \
   docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
  echo "==> Deploy OK"
else
  echo "!! Health check failed — check: docker compose logs app"
  exit 1
fi
