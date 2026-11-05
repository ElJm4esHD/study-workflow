#!/usr/bin/env bash
# Corre en el server: bash -s <sha> <puerto>, leído del repo bare. Los comandos que podrían leer stdin
# llevan </dev/null porque bash está leyendo este mismo script por stdin.
set -euo pipefail
SHA=$1
export PORT=${2:?falta el puerto}
APP=$HOME/apps/study-workflow
DATA=/srv/study-workflow
cd "$APP"

dc() { local tag=$1 rel=$2; shift 2; IMAGE_TAG=$tag docker compose -p study-workflow -f "releases/$rel/compose.yaml" "$@" </dev/null; }

PREV=$(cat .deployed 2>/dev/null || true)
if [ "$PREV" = "$SHA" ]; then echo "Ya está desplegada la versión $SHA."; exit 0; fi

# Nunca queda un release a medio extraer: se borra antes de reintentar.
rm -rf "releases/$SHA"; mkdir -p "releases/$SHA"
git --git-dir "$HOME/git/study-workflow.git" archive "$SHA" | tar -x -C "releases/$SHA"
# compose lee este .env: los comandos manuales en el release (restore, logs) usan el mismo puerto.
printf 'PORT=%s\nIMAGE_TAG=%s\n' "$PORT" "$SHA" > "releases/$SHA/.env"

if ! docker build --build-arg APP_VERSION="$SHA" -t "study-workflow:$SHA" "releases/$SHA" </dev/null; then
  echo "BUILD FALLÓ"; rm -rf "releases/$SHA"; exit 1
fi

BACKUP=""
if [ -n "$PREV" ] && [ -n "$(dc "$PREV" "$PREV" ps -q app)" ]; then
  BACKUP=pre-deploy-$(date +%Y%m%d-%H%M%S).sqlite
  dc "$PREV" "$PREV" exec -T app node core/server/backup.ts "/data/backups/$BACKUP" \
    || { echo "BACKUP FALLÓ, no se toca nada"; exit 1; }
fi

dc "$SHA" "$SHA" up -d || echo "UP FALLÓ"
for i in $(seq 15); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" </dev/null >/dev/null 2>&1; then
    echo "$SHA" > .deployed
    # Se conservan los 3 más nuevos y siempre el actual y el anterior.
    ls -1t releases | grep -vxF -e "$SHA" -e "$PREV" | tail -n +2 | xargs -r -I{} rm -rf "releases/{}" || true
    docker images study-workflow --format '{{.Tag}}' </dev/null | grep -vx latest | grep -vxF -e "$SHA" -e "$PREV" \
      | tail -n +2 | xargs -r -I{} docker rmi "study-workflow:{}" >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

echo "HEALTH CHECK FALLÓ, volviendo a la versión anterior"
dc "$SHA" "$SHA" logs --tail 30 app || true
dc "$SHA" "$SHA" stop app
if [ -z "$PREV" ]; then echo "No hay versión anterior a la que volver."; exit 1; fi
if [ -n "$BACKUP" ]; then
  cp "$DATA/backups/$BACKUP" "$DATA/study.sqlite"
  rm -f "$DATA/study.sqlite-wal" "$DATA/study.sqlite-shm"
fi
dc "$PREV" "$PREV" up -d
exit 1
