#!/usr/bin/env bash
# Corre en el server: bash -s <sha> <puerto> [nombre], leído del repo bare. El nombre (por defecto study-workflow; study-workflow-next para la
# versión de prueba) separa contenedor, imágenes, carpeta de releases y datos (/srv/<nombre>). Los comandos que podrían leer stdin
# llevan </dev/null porque bash está leyendo este mismo script por stdin.
set -euo pipefail
SHA=$1
export PORT=${2:?falta el puerto}
NAME=${3:-study-workflow}
APP=$HOME/apps/$NAME
DATA=/srv/$NAME
cd "$APP"

dc() { local tag=$1 rel=$2; shift 2; IMAGE_NAME=$NAME IMAGE_TAG=$tag DATA_DIR=$DATA docker compose -p "$NAME" -f "releases/$rel/compose.yaml" "$@" </dev/null; }

PREV=$(cat .deployed 2>/dev/null || true)
if [ "$PREV" = "$SHA" ]; then echo "Ya está desplegada la versión $SHA."; exit 0; fi

# Nunca queda un release a medio extraer: se borra antes de reintentar.
rm -rf "releases/$SHA"; mkdir -p "releases/$SHA"
git --git-dir "$HOME/git/study-workflow.git" archive "$SHA" | tar -x -C "releases/$SHA"
# compose lee este .env: los comandos manuales en el release (restore, logs) usan el mismo puerto.
printf 'PORT=%s\nIMAGE_TAG=%s\n' "$PORT" "$SHA" > "releases/$SHA/.env"

if ! docker build -t "$NAME:$SHA" "releases/$SHA" </dev/null; then
  echo "BUILD FALLÓ"; rm -rf "releases/$SHA"; exit 1
fi

# El archivo de base de la versión que está corriendo (study.sqlite en la 1.x, sync.sqlite en la 2.x): el backup y la vuelta atrás son de ese.
BACKUP=""
PREVDB=""
if [ -n "$PREV" ] && [ -n "$(dc "$PREV" "$PREV" ps -q app)" ]; then
  BACKUP=pre-deploy-$(date +%Y%m%d-%H%M%S).sqlite
  dc "$PREV" "$PREV" exec -T app node core/server/backup.ts "/data/backups/$BACKUP" \
    || { echo "BACKUP FALLÓ, no se toca nada"; exit 1; }
  PREVDB=$(basename "$(dc "$PREV" "$PREV" exec -T app printenv DB_PATH | tr -d '[:space:]')")
fi

dc "$SHA" "$SHA" up -d || echo "UP FALLÓ"
for i in $(seq 15); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" </dev/null >/dev/null 2>&1; then
    echo "$SHA" > .deployed
    # Se conservan los 3 más nuevos y siempre el actual y el anterior.
    ls -1t releases | grep -vxF -e "$SHA" -e "$PREV" | tail -n +2 | xargs -r -I{} rm -rf "releases/{}" || true
    docker images "$NAME" --format '{{.Tag}}' </dev/null | grep -vx latest | grep -vxF -e "$SHA" -e "$PREV" \
      | tail -n +2 | xargs -r -I{} docker rmi "$NAME:{}" >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

echo "HEALTH CHECK FALLÓ, volviendo a la versión anterior"
dc "$SHA" "$SHA" logs --tail 30 app || true
dc "$SHA" "$SHA" stop app
if [ -z "$PREV" ]; then echo "No hay versión anterior a la que volver."; exit 1; fi
if [ -n "$BACKUP" ] && [ -n "$PREVDB" ]; then
  cp "$DATA/backups/$BACKUP" "$DATA/$PREVDB"
  rm -f "$DATA/$PREVDB-wal" "$DATA/$PREVDB-shm"
fi
dc "$PREV" "$PREV" up -d
exit 1
