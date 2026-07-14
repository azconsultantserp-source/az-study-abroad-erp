#!/usr/bin/env bash
# Create temporary self-signed certs so Nginx can start the first time.
# Let's Encrypt replaces them afterward via certbot.
set -euo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  read -rp "Domain (e.g. erp.yourdomain.com): " DOMAIN
fi
DOMAIN="${DOMAIN:?Domain is required}"

DIR="deploy/certbot/conf/live/${DOMAIN}"
mkdir -p "$DIR"

if [ -f "$DIR/fullchain.pem" ] && [ -f "$DIR/privkey.pem" ]; then
  echo "==> Certs already exist at $DIR — skipping."
  exit 0
fi

openssl req -x509 -nodes -newkey rsa:2048 -days 3 \
  -keyout "$DIR/privkey.pem" \
  -out "$DIR/fullchain.pem" \
  -subj "/CN=${DOMAIN}"

echo "==> Temporary self-signed certs created for ${DOMAIN}"
echo "    After first-run completes, issue real Let's Encrypt certs (see DEPLOYMENT.md)."
