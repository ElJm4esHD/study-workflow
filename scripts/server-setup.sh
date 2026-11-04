#!/usr/bin/env bash
# Setup inicial del server (idempotente). Se corre con: npm run server-setup
set -euo pipefail
PORT=${1:-8080}
DATA=/srv/study-workflow

git init --bare -q -b main "$HOME/git/study-workflow.git"
mkdir -p "$HOME/apps/study-workflow/releases"

if mkdir -p "$DATA/backups" 2>/dev/null && [ "$(stat -c %u "$DATA")" = 1000 ]; then
  echo "OK: $DATA/backups"
else
  echo "FALTA: crear $DATA con permisos. Corré en el server:"
  echo "  sudo mkdir -p $DATA/backups && sudo chown -R 1000:1000 $DATA"
fi

docker compose version >/dev/null || echo "FALTA: Docker Compose v2 (¿el usuario está en el grupo docker?)"
if ss -ltn | grep -q ":$PORT "; then echo "AVISO: el puerto $PORT ya está en uso (normal si ya deployaste)."; fi

echo
echo "Último paso (una sola vez, necesita sudo y una terminal interactiva):"
echo "  sudo tailscale serve --bg --https=443 http://127.0.0.1:$PORT"
echo "Después queda en https://<host>.ts.net y sobrevive a los reinicios."
