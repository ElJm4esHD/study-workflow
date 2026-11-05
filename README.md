# Study Workflow

App personal para organizar la facultad y el día: to-do, calendario, materias y parciales. Un solo usuario, self-hosted (Docker en el server, acceso por Tailscale).

Stack: Node 24 (TypeScript con type stripping, `node:sqlite`), Fastify, React + Vite. Interfaz en español (Argentina).

## Correr en local

```
npm install
npm run dev          # server (:3000) + Vite con proxy /api
npm test
npm run typecheck
```

La base local queda en `./data/study.sqlite`.

## Deploy

Datos en el server: `/srv/study-workflow/` (`study.sqlite` y `backups/`). Backup = copiar esa carpeta.

### 1. Clave SSH (una vez, desde PowerShell)

```
ssh-keygen -t ed25519
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh tu-usuario@<host> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
ssh tu-usuario@<host> echo ok
```

`<host>` es el hostname MagicDNS del server (el de `tailscale status`).

### 2. Configuración y setup inicial

Copiá `.env.deploy.example` a `.env.deploy` (no se commitea) y completá `DEPLOY_HOST`, `PORT` (puerto local del contenedor) y `HTTPS_PORT` (puerto de `tailscale serve`). Es la única configuración del puerto: compose, el health check del deploy y el setup la leen de ahí. Después:

```
npm run server-setup
```

Crea el repo bare `~/git/study-workflow.git`, `~/apps/study-workflow/` y `/srv/study-workflow/backups` (si faltan permisos, avisa el `sudo mkdir` + `chown 1000:1000` que hay que correr). Es idempotente.

### 3. HTTPS con `tailscale serve`

El setup imprime el comando con tus puertos; correlo una vez en el server (con sudo):

```
ssh -t tu-usuario@<host> sudo tailscale serve --bg --https=<HTTPS_PORT> http://127.0.0.1:<PORT>
```

Solo agrega ese puerto: lo que `tailscale serve` ya publica en otros puertos (por ejemplo otra app en 443) no se toca. Revisalo antes y después con `tailscale serve status`.

Requiere MagicDNS y HTTPS certificates habilitados en el admin de Tailscale. Con `--bg` queda persistente y se retoma solo después de un reinicio. La app queda en `https://<host>:<HTTPS_PORT>`. El contenedor solo escucha en `127.0.0.1`: sin exposición a internet.

### 4. Deployar

```
npm run deploy
```

Exige árbol limpio y rama `main`, hace push al repo del server y por SSH construye la imagen, hace backup de la base, levanta el contenedor nuevo y espera `/api/health`. Si falla el build no toca nada; si falla el health check, restaura el backup, vuelve a levantar la versión anterior y termina con `✖ Deploy FALLÓ`. Se conservan las 3 versiones más nuevas.

### Backups y restore

Antes de cada deploy se guarda `/srv/study-workflow/backups/pre-deploy-<fecha>.sqlite` (las últimas 10). Para restaurar a mano, en el server:

```
cd ~/apps/study-workflow
V=$(cat .deployed)   # el .env de cada release ya trae PORT e IMAGE_TAG
docker compose -p study-workflow -f releases/$V/compose.yaml stop app
cp /srv/study-workflow/backups/<backup>.sqlite /srv/study-workflow/study.sqlite
rm -f /srv/study-workflow/study.sqlite-wal /srv/study-workflow/study.sqlite-shm
docker compose -p study-workflow -f releases/$V/compose.yaml up -d
```

## Agregar un módulo

Una carpeta en `modules/<id>/` y registrarla en `modules/server.ts` y `modules/web.ts`. Contrato y ejemplo en [docs/modulos.md](docs/modulos.md).

## Importar planes

El formato JSON que genera Claude está en [docs/formato-importacion.md](docs/formato-importacion.md).

## Compilar el APK

Fase 2 (todavía no hecho).
