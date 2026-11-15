#!/usr/bin/env bash
# Setup inicial del server (idempotente). Se corre con: npm run server-setup
set -euo pipefail
PORT=${1:?falta el puerto}
HTTPS_PORT=${2:?falta el puerto HTTPS}
NAME=${3:-study-workflow} # study-workflow-next para la versión de prueba
DATA=/srv/$NAME

git init --bare -q -b main "$HOME/git/study-workflow.git"
mkdir -p "$HOME/apps/$NAME/releases"

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
echo "  sudo tailscale serve --bg --https=$HTTPS_PORT http://127.0.0.1:$PORT"
echo "No toca lo que ya publica tailscale serve en otros puertos (miralo con: tailscale serve status)."
echo "Después queda en https://<host>:$HTTPS_PORT y sobrevive a los reinicios."
