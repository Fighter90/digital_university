#!/usr/bin/env bash
# Deploy digital_university to the production server (ostrovok.store).
# Requires: ssh key access to DIG_SERVER_HOST (root), rsync, docker on the server.
# Env: DIG_SERVER_HOST (default 186.243.219.107), DIG_DEPLOY_KEY (~/.ssh/dig_deploy).
set -euo pipefail
cd "$(dirname "$0")/../.."

HOST="${DIG_SERVER_HOST:-186.243.219.107}"
USER_="${DIG_SERVER_USER:-root}"
KEY="${DIG_DEPLOY_KEY:-$HOME/.ssh/dig_deploy}"
DIR="/opt/digital-university"
SSH="ssh -i $KEY -o IdentitiesOnly=yes -o ConnectTimeout=20 $USER_@$HOST"

echo "==> rsync repo → $HOST:$DIR"
rsync -az --delete \
  --exclude .git --exclude node_modules --exclude .next --exclude .env \
  --exclude .task-board --exclude test-results --exclude playwright-report \
  ./ "$USER_@$HOST:$DIR/" -e "ssh -i $KEY -o IdentitiesOnly=yes"

echo "==> write server .env (from local .env.production if present)"
if [ -f .env.production ]; then
  rsync -az .env.production "$USER_@$HOST:$DIR/.env" -e "ssh -i $KEY -o IdentitiesOnly=yes"
fi

echo "==> docker compose build + up"
$SSH "cd $DIR && docker compose -f deploy/docker-compose.yml build && docker compose -f deploy/docker-compose.yml up -d"

echo "==> health check"
for i in $(seq 1 30); do
  if $SSH "curl -fsS http://localhost:3000/api/health >/dev/null 2>&1"; then echo "OK: app healthy"; exit 0; fi
  sleep 5
done
echo "FAIL: health check did not pass in 150s"; exit 1
