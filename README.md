# Study Workflow

App personal para organizar la facultad y el día: to-do, calendario, materias y parciales. Un solo usuario, self-hosted (Docker en el server, acceso por Tailscale).

Stack: Node 24 (TypeScript con type stripping, `node:sqlite`), Fastify, React + Vite. Interfaz en español (Argentina).

## Correr en local

```
npm install
npm run dev          # server (:3000) + Vite con proxy /api
npm test
npm run typecheck
npm run a11y         # auditoría de accesibilidad (axe + Playwright) a 412 y 1440 px, con base temporal
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

## Qué cambió de uso (Hito C)

- **Inicio**: pantalla de entrada con tarjetas de Hoy (tiempo pendiente de tiempo total), próximo examen y próximos 7 días.
- **Sigla**: cada materia tiene una sigla de hasta 5 letras (se sugiere sola; editable en Ajustes) que se usa en los chips.
- **Duración y categoría**: cada to-do puede llevar duración estimada y categoría (tarea, entrega, estudio); el tiempo se suma por día y por materia.
- **Importar**: la vista previa muestra duración y categoría; el formato pasó a v2 (ver [docs/formato-importacion.md](docs/formato-importacion.md)).

## Qué cambió de uso (observaciones 14/11)

- **Finales** (pantalla nueva): cargás las fechas posibles de cada materia (a mano o pegando el JSON de la skill, ver [docs/formato-finales.md](docs/formato-finales.md)), filtrás y ordenás las combinaciones y elegís una. Elegir crea los eventos `final` en el calendario; "Deshacer" los borra.
- **Subtareas**: una tarea puede tener subtareas. En las listas y en el widget se ve el progreso (`2/4`); tocando ese contador (en To-do y en Inicio › Hoy) se despliegan debajo de la tarea y se tildan ahí mismo (o abriendo la tarea), y tildarlas todas completa la principal. Sin conexión solo se tilda la principal.
- **Recordatorios**: tareas (con fecha) y eventos pueden sonar en el celu a la hora, 15 min, 1 h o 1 día antes, o un tiempo a elección. Con "Insistente" sigue sonando hasta que la atiendas. Detalles en [docs/android.md](docs/android.md).
- **Atrás en el celu**: vuelve dentro de la app; sin historial va a la pantalla padre y recién desde una pantalla principal minimiza.
- **Compu**: To-do tiene siempre el panel de la derecha (editar o nueva tarea) y las pantallas usan el ancho.
- **Agenda**: se sacaron el widget Agenda y la vista Agenda del calendario (quedan Mes y Semana).
- **Importar**: el formato pasó a v3 (subtareas).

## Qué cambió de uso (pulido UX/UI)

- **Navegación del celu**: abajo quedan Inicio, To-do, Calendario y **Más** (Finales, Importar y Ajustes). En la compu, barra lateral con todas las secciones y Ajustes abajo.
- **Gestos (celu)**: deslizar a los costados en cualquier parte (menos sobre la grilla del calendario, que cambia de mes) pasa entre Inicio, To-do y Calendario. Las tareas ya no se completan ni se borran deslizándolas: se tildan con el cuadradito y se borran desde su pantalla. Tirar hacia abajo en To-do o Calendario refresca. La hoja del día se cierra arrastrándola hacia abajo. Reordenar sigue siendo mantener apretado y arrastrar.
- **Atajos (compu)**: `1`…`n` cambian de pantalla (el número aparece al pasar el mouse por la barra lateral), `N` nueva tarea, `Esc` cierra hojas.
- **Agregar tarea**: en el celu, con el botón flotante; en la compu, con el campo de arriba de la lista (Enter) o el panel.
- **Ajustes de este dispositivo** (no se sincronizan): velocidad de animaciones (o "Sin animaciones"), vibración (solo APK, con los efectos nativos del celu: suave, media o fuerte) y tamaño de letra.
- **Widget To-do**: mismo estilo que la app (cuadradito y barra con el color de la materia, segunda línea con sigla, hora o "venció" y subtareas, botón + para nueva tarea; tocar "To-do" abre la lista).
- **Finales**: los filtros y el orden van plegados en "Filtros y orden"; el resumen muestra lo aplicado.
- **Ajustes › Materias**: tocar la fila edita; el ícono de la derecha archiva.

## Qué cambió de uso (pulido final, etapa 2)

- Fechas y horas se tipean (`5/11`, `hoy`, `mañana`, `930`) o se eligen en un calendario propio (botón del calendario, flechas, Enter).
- Borrar una tarea o un evento ya no pregunta: avisa y deja "Deshacer" 6 s.
- Si salís de una tarea o evento con cambios sin guardar, avisa.
- "Reducir movimiento" del sistema arranca la app en "Sin animaciones" (se cambia en Ajustes).
- Las fechas se leen "Hoy", "Mañana", "En 3 días", "Vencida hace 2 días".

## Qué cambió de uso (pulido final, etapa 3)

- **Ajustes** en secciones: General (pantalla de inicio, guía), Materias, Módulos, Tareas (duración, categoría y ocultar completadas), Calendario, Recordatorios (anticipación e insistente por defecto, probar sonido), Apariencia (letra, color de acento, animaciones, vibración), Datos, Servidor y Acerca de (versiones y Novedades).
- **Búsqueda global** de tareas y eventos: `/` o Ctrl+K en la compu; "Buscar" en el menú Más del celu.
- **Backup**: Ajustes › Datos › Exportar baja un .json con todo; Importar lo restaura (reemplaza todo; el servidor guarda antes una copia en `/data/backups/pre-import-*.sqlite`).
- **Guía de primera vez** (3 pasos, salteable); se reabre desde Ajustes › General.

## Agregar un módulo

Una carpeta en `modules/<id>/` y registrarla en `modules/server.ts` y `modules/web.ts`. Contrato y ejemplo en [docs/modulos.md](docs/modulos.md).

## Importar planes

El formato JSON que genera Claude está en [docs/formato-importacion.md](docs/formato-importacion.md). El de las fechas de finales, en [docs/formato-finales.md](docs/formato-finales.md).

## Compilar el APK

Con Android Studio instalado:

```
npm run apk -- --check   # verifica JDK, SDK y llave de firma
npm run apk              # arma dist/study-workflow.apk firmado (incluye los widgets: ver docs/android.md)
```

La llave de firma vive en `%USERPROFILE%\.study-workflow\` (hacele backup). Cómo pasarlo al celu, la primera apertura y problemas comunes: [docs/android.md](docs/android.md).
