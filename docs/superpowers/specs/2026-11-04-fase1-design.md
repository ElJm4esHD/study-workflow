# Study Workflow — Diseño Fase 1 (backend + web)

Fecha: 04/11/2026 · Fuente principal: `CLAUDE.md` (no se repite acá salvo cuando hace falta precisar).
Las decisiones marcadas **[mía]** las tomé yo; revisalas. Las marcadas **[tuya]** salen de tus respuestas.

---

## 1. Intención

App personal para organizar la facultad y el día: to-do, calendario, materias e importación de planes generados en chats de Claude. La usa un solo usuario, desde la compu y el celu. La Fase 1 deja andando el backend y la web, deployados en `tu-server` detrás de `tailscale serve`, con la base de datos y la arquitectura modular preparadas para que la Fase 2 (APK offline) y la Fase 3 (widgets) no obliguen a rehacer nada.

**Éxito de la Fase 1:** la uso desde el navegador del celu y de la compu vía `https://<host>.ts.net`, cargo un plan pegado desde Claude en menos de un minuto y el deploy es un solo comando que no rompe lo que está corriendo.

### Objetivos
- Núcleo + contrato de módulos (backend y frontend) + Materias.
- Módulos To-do, Calendario (con repetición semanal) e Importar plan (con registro de planes).
- Docker Compose, deploy de un comando desde Windows y `tailscale serve`.
- Tests de API y de dominio con TDD.
- `docs/modulos.md`, `docs/formato-importacion.md` y `README.md`.

### No-objetivos (Fase 1)
- APK, caché offline, cola de sincronización y CORS para Capacitor (Fase 2).
- Widgets (Fase 3).
- Login (solo queda el punto de enganche).
- Sincronización con Google o Samsung.
- Repetición distinta de la semanal (diaria, mensual, cada N semanas), y la opción "esta y las siguientes".

### Anti-objetivos (fallaría aunque "funcione")
- Que agregar un módulo obligue a tocar otro módulo.
- Que un deploy fallido deje la app caída o pierda datos.
- Que la UI muestre una pantalla en blanco ante un error.
- Que en el celu sea incómoda de usar con una mano.
- Un modelo de datos que obligue a migrar todo para el offline de la Fase 2.

---

## 2. Decisiones que tomaste vos

1. **[tuya] Repetición semanal simple:** días de la semana + fecha "hasta" opcional. Al editar o borrar una ocurrencia de una serie, pregunta "¿Solo este evento o toda la serie?".
2. **[tuya] Los planes importados se guardan** con título y progreso (tareas hechas / total). Al borrar un plan, pregunta si borrar también las tareas completadas o solo las pendientes.
3. **[tuya] FullCalendar, solo plugins MIT.** Las repeticiones se expanden en el backend con lógica propia (incluidas las excepciones), y FullCalendar recibe las ocurrencias ya expandidas. Touch: tocar un día crea un evento y deslizar cambia de semana o de mes.
4. **[tuya] Deploy con git:** repo bare en el server, push por SSH al hostname de Tailscale (no a la IP de la LAN). El script tiene que andar en Windows (PowerShell o Git Bash). Si el build falla, avisa y la versión que está corriendo sigue en pie. El README te guía para configurar la clave SSH.

---

## 3. Stack y dependencias

Cada dependencia, con su justificación en una línea:

| Dependencia | Dónde | Por qué |
|---|---|---|
| `fastify` | server | Lo pide CLAUDE.md. Además valida JSON Schema sin otra librería y `register(plugin, {prefix})` implementa directamente "rutas bajo `/api/<id>`". |
| `@fastify/static` | server | Servir el build del frontend desde el mismo contenedor. |
| `react`, `react-dom` | web | Stack definido. |
| `react-router` | web | Rutas por módulo y links directos (`/todo/:id`, `/calendario?fecha=`) que van a necesitar los widgets en la Fase 3. |
| `@fullcalendar/react` (trae daygrid, timegrid, list e interaction como entrypoints `@fullcalendar/react/*`) | web | [tuya] Vistas mes, semana y lista; `interaction` es el plugin MIT para tocar un día o una franja horaria. |
| `temporal-polyfill` | web | Peer obligatorio de FullCalendar 7. |
| `@dnd-kit/core`, `@dnd-kit/sortable` | web | Reordenar con el dedo sin pelearse con el scroll (activación con long-press). Hacerlo a mano en touch es frágil. |
| `vite`, `@vitejs/plugin-react`, `typescript`, `@types/*` | dev | Stack definido. |
| `vitest` | dev | Tests de server y web con la misma herramienta que Vite; la API se prueba con `fastify.inject`, sin red. |

**SQLite:** se usa `node:sqlite` (integrado en Node) si en la LTS vigente ya no es experimental; si no, `better-sqlite3`. Lo verifico con Context7 al armar el plan. **[mía]**
**TypeScript en el server sin build:** Node ejecuta `.ts` directamente (type stripping). `tsc --noEmit` solo hace el chequeo de tipos. Esto obliga a `erasableSyntaxOnly` (sin `enum`) y a imports con extensión `.ts`. Lo verifico con Context7. **[mía]**

**Sin:** librería de fechas, de estado o de CSS, ORM, librería de UUID (`crypto.randomUUID`), ni validación aparte de Fastify. Los íconos son SVG inline. **[mía]**

Todo va en un único `package.json` en la raíz, sin workspaces. Las dependencias del frontend van en `devDependencies` porque quedan dentro del bundle, así que `npm ci --omit=dev` deja una imagen liviana. **[mía]**

---

## 4. Estructura del repo

```
core/
  server/            main.ts (arranque), app.ts, db.ts, migrate.ts, registry.ts, auth.ts, materias.ts, settings.ts
  server/migrations/ 001_core.sql
  web/               shell (layout, nav, tema), registry.ts, api.ts, materias/, ajustes/
  shared/            dates.ts (hoy en AR, semana desde el lunes, dd/mm/aaaa), normalize.ts
modules/
  server.ts          ← registro backend: lista de módulos
  web.ts             ← registro frontend: lista de módulos
  todo/      server/ (index.ts, service.ts, migrations/)   web/ (index.tsx, páginas)
  calendar/  server/ ...                                    web/ ...
  import/    server/ (incluye parser.ts)                    web/ ...
web/                 index.html, main.tsx (raíz de Vite)
scripts/             dev.mjs, deploy.mjs, remote-deploy.sh, server-setup.sh
docs/                modulos.md, formato-importacion.md, superpowers/specs/
Dockerfile, compose.yaml, README.md
```

**[mía]** Cada módulo vive en **una sola carpeta** `modules/<id>/`, con las subcarpetas `server/` y `web/`. Para agregar un módulo se crea esa carpeta y se suma una línea en `modules/server.ts` y otra en `modules/web.ts`. La web puede hacer `import type` desde `../server/` de su propio módulo para compartir tipos. Esos imports se borran al compilar, así que no se mezcla código.

**[mía]** Los ids, las rutas de API, las tablas y el código están en inglés (`todo`, `calendar`, `import`). Las rutas visibles y la UI están en español (`/todo`, `/calendario`, `/importar`). "Materia" queda en español en todos lados porque es un término del dominio y del formato de importación.

---

## 5. Contrato de módulos

### Backend

```ts
// core/server/registry.ts
export interface ServerModule {
  id: string;                 // 'todo' → rutas montadas en /api/todo
  migrationsDir: URL;         // carpeta con 001_*.sql, 002_*.sql…
  requires?: string[];        // ids de módulos de los que depende (ej. import → ['todo','calendar'])
  routes(app: FastifyInstance, ctx: CoreContext): Promise<void>;  // se registra con prefix /api/<id>
  service?(ctx: CoreContext): object;  // queda disponible para otros como ctx.services.get(id)
}

export interface CoreContext {
  db: Database;                                  // conexión SQLite (síncrona, única)
  transaction<T>(fn: () => T): T;                // BEGIN/COMMIT/ROLLBACK
  materias: MateriasService;                     // entidad compartida del núcleo
  settings: SettingsService;
  modules: { isEnabled(id: string): boolean };
  services: { get<T>(id: string): T | undefined };
}
```

Reglas:
- Cada módulo solo toca tablas con su prefijo (`todo_*`, `calendar_*`, `import_*`). Para datos de otro módulo usa `ctx.services.get<TodoService>('todo')`, tipado con `import type` desde ese módulo. Las materias se leen solo con `ctx.materias`.
- Sus tablas pueden tener FK a `materias(id)`, que es del núcleo y nunca se borra (solo se archiva).
- **Activar o desactivar un módulo cambia lo que muestra la UI**: el módulo sale de la navegación y deja de aportar datos a otros (por ejemplo, el calendario deja de mostrar to-dos). Las migraciones y la API siguen corriendo para que no se pierdan datos. **[mía]**
- Desactivar un módulo del que otro depende desactiva también al dependiente, con aviso en Ajustes. **[mía]**
- Auth: `core/server/auth.ts` es un hook `onRequest` que hoy deja pasar todo. Ahí se engancha el login más adelante.

### Frontend

```ts
// core/web/registry.ts
export interface WebModule {
  id: string;
  name: string;                         // "To-do"
  icon: ComponentType;                  // SVG inline
  routes: RouteObject[];                // react-router, paths absolutos
  nav?: { path: string; order: number };// ítem de navegación (label = name)
  settings?: ComponentType;             // panel opcional dentro de Ajustes
  requires?: string[];
}
```

- El shell arma la navegación con los módulos habilitados, ordenados por `order`. **[mía]** En el celu, barra inferior (To-do, Calendario, Importar, Ajustes); en la compu, barra lateral. Materias y los switches de módulos van dentro de Ajustes. *shortcut: si en el futuro hay más de 4 ítems, se agrega un "Más".*
- Todo pedido a la API pasa por `core/web/api.ts`. Los módulos nunca llaman a `fetch` directo. **Así, la caché y la cola offline de la Fase 2 se agregan en un solo lugar.**
- `docs/modulos.md` explica el contrato con un módulo de ejemplo mínimo (una migración, una ruta y una página).

---

## 6. Modelo de datos

Convenciones **[mía]**:
- Ids `TEXT` con UUID. El cliente puede mandarlo al crear (eso necesita la Fase 2 para crear sin conexión); si no lo manda, lo genera el server. Un POST repetido con el mismo id devuelve el existente, así que reintentar es seguro.
- `created_at` y `updated_at` en ISO-8601 UTC. `updated_at` lo va a usar la Fase 2 para resolver conflictos por última escritura.
- Fechas de usuario como **hora local de Argentina en texto**: `date` = `YYYY-MM-DD`, `time` = `HH:MM`. Argentina no tiene horario de verano (UTC−3 fijo), así que no hace falta convertir y la expansión de repeticiones es aritmética de fechas pura.
- Borrado físico, sin soft-delete: en la Fase 2 el cliente vuelve a pedir la lista entera al reconectar, y lo que no viene se da por borrado.
- **Nota para la Fase 2 [tuya]:** para resolver conflictos, `updated_at` tiene que ser **el momento del cambio en el cliente**, no el de llegada al server. Así una edición offline vieja no pisa una más nueva. El server aplica un cambio solo si su `updated_at` es mayor o igual al guardado. En la Fase 1 esto no cambia nada: el server sigue poniendo `updated_at`.

```sql
-- núcleo (core/server/migrations/001_core.sql)
CREATE TABLE migrations (module TEXT NOT NULL, version INTEGER NOT NULL, applied_at TEXT NOT NULL,
                         PRIMARY KEY (module, version));
CREATE TABLE settings   (key TEXT PRIMARY KEY, value TEXT NOT NULL);  -- value en JSON
CREATE TABLE materias (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,      -- normalizado: trim, minúsculas, sin tildes
  color TEXT NOT NULL,                -- hex de la paleta fija
  archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

-- todo (modules/todo/server/migrations/001_todo.sql)
CREATE TABLE todo_items (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, notes TEXT,
  due_date TEXT, due_time TEXT,               -- due_time exige due_date
  materia_id TEXT REFERENCES materias(id),
  completed INTEGER NOT NULL DEFAULT 0, completed_at TEXT,
  sort_order REAL NOT NULL,                   -- orden fraccional: mover = 1 UPDATE
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

-- calendar (modules/calendar/server/migrations/001_calendar.sql)
CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, notes TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('evento','parcial','recuperatorio','final')),
  materia_id TEXT REFERENCES materias(id),
  all_day INTEGER NOT NULL,
  start_date TEXT NOT NULL, start_time TEXT,  -- start_time null ⇔ all_day
  end_date TEXT NOT NULL, end_time TEXT,      -- end_time opcional
  repeat_weekdays TEXT,                       -- '1,3' (1=lunes … 7=domingo); null = no se repite
  repeat_until TEXT,                          -- opcional; null = sin fin
  series_id TEXT REFERENCES calendar_events(id) ON DELETE CASCADE,  -- ocurrencia separada de una serie
  original_date TEXT,                         -- fecha de la serie que reemplaza
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE calendar_exdates (
  event_id TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  date TEXT NOT NULL, PRIMARY KEY (event_id, date));

-- import (modules/import/server/migrations/001_import.sql)
CREATE TABLE import_plans (id TEXT PRIMARY KEY, title TEXT, created_at TEXT NOT NULL);
CREATE TABLE import_plan_items (
  plan_id TEXT NOT NULL REFERENCES import_plans(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('todo','event')),
  item_id TEXT NOT NULL,                      -- sin FK: la tabla es de otro módulo
  PRIMARY KEY (plan_id, item_type, item_id));
```

**Settings** (claves JSON): `modules.enabled` = `{ "todo": true, "calendar": true, "import": true }`; `calendar.initialView` = `"mes" | "semana" | "agenda"` (panel de ajustes del calendario; es el único uso real del campo `settings` del contrato, así ese camino también queda probado). **[mía]**

**Migraciones:** al arrancar se corren primero las del núcleo y después las de cada módulo, en el orden del registro (que respeta `requires`). Cada archivo `NNN_*.sql` se aplica en su propia transacción y se anota en `migrations`. No hay "down".

---

## 7. API (JSON, errores `{ "error": { "code", "message" } }` con mensaje en español)

**Núcleo**
- `GET /api/health` → `{ ok: true, version }` (lo usa el deploy).
- `GET /api/materias` · `POST /api/materias` · `PATCH /api/materias/:id` (name, color, archived). No existe DELETE.
- `GET /api/settings` · `PATCH /api/settings` (merge de claves).

**To-do** (`/api/todo`)
- `GET /` → todos los ítems. *shortcut: sin paginación; un solo usuario genera unos miles por año. Si la respuesta pasa de ~1 MB, paginar las completadas.*
- `GET /:id` · `POST /` · `PATCH /:id` (parcial: incluye `completed` y `sort_order`) · `DELETE /:id`.
- Servicio: `listDated(from, to)`, `findByDates(dates)`, `createMany(items)`, `getByIds(ids)`, `deleteByIds(ids, { includeCompleted })`.

**Calendario** (`/api/calendar`)
- `GET /agenda?from=YYYY-MM-DD&to=YYYY-MM-DD` (máx. 400 días) → `{ events: Occurrence[], todos: TodoItem[] }`. Las ocurrencias ya vienen expandidas y los to-dos con fecha se suman si el módulo To-do está habilitado. Este mismo endpoint lo va a usar el widget Agenda de la Fase 3.
- `GET /events/:id` · `POST /events` · `PATCH /events/:id` (si es una serie, edita **toda la serie**) · `DELETE /events/:id` (si es una serie, la borra entera junto con sus ocurrencias separadas).
- `PUT /events/:id/occurrences/:date`: **"solo este evento"**. En una transacción, agrega un exdate a la serie y crea (o actualiza) un evento separado con `series_id` y `original_date`.
- `DELETE /events/:id/occurrences/:date`: agrega un exdate (si había una ocurrencia separada, también la borra).
- `Occurrence` = campos del evento + `eventId`, `occurrenceDate`, `isRecurring`, `id: "<eventId>:<fecha>"`.
- Servicio: `findByDates(dates)`, `createMany(items)`, `deleteByIds(ids, { exceptKinds? })`.

**Importar** (`/api/import`)
- `POST /preview { text }` → `{ plan: { title, materia }, items: PreviewItem[], unresolvedMaterias: string[] }`. Es sin estado.
  `PreviewItem` = `{ index, tipo, fecha, hora, titulo, notas, materiaName, materiaId | null, errors: string[], duplicate: boolean }`.
- `POST /commit { text, include: number[], materias: { [nameKey]: { materiaId } | { create: { name, color } } } }`. **[mía]** El server vuelve a parsear `text` en lugar de confiar en ítems armados por el cliente. Así la validación se hace una sola vez, en el borde. Todo pasa en una transacción: crea las materias nuevas, crea los to-dos y eventos con los servicios y registra el plan. Los ítems con errores se rechazan aunque vengan en `include`.
- `GET /plans` → `[{ id, title, createdAt, tasksDone, tasksTotal, eventsCount }]`. El progreso se calcula con `todo.getByIds`; los ítems que borraste a mano no cuentan.
- `DELETE /plans/:id?includeCompleted=true|false&keepExams=true|false`: borra las tareas pendientes del plan (y también las completadas si `includeCompleted=true`), borra sus eventos comunes (`evento`) siempre y borra sus exámenes (`parcial`, `recuperatorio`, `final`) solo si `keepExams=false`. Al final borra el registro del plan; los exámenes que se mantienen quedan como eventos sueltos. **[tuya]** En el diálogo, la casilla "Mantener los exámenes (parcial/recuperatorio/final)" viene tildada por defecto. El diálogo muestra cuántos ítems se van a borrar.

La validación de entrada usa los JSON Schemas de Fastify en cada ruta. Las reglas que cruzan campos (hora sin fecha, fin antes del inicio, repetición en un evento de varios días) van en el servicio y se testean.

---

## 8. Reglas de dominio

### Fechas
- `core/shared/dates.ts`: `today()` en `America/Argentina/Buenos_Aires` (con `Intl`, sin depender de la zona horaria del dispositivo), aritmética sobre `YYYY-MM-DD` y formato `dd/mm/aaaa`. La semana empieza el lunes en todos lados, incluido FullCalendar (`firstDay: 1`, locale `es`).

### Materias
- La paleta es fija, de unos 12 colores de tono medio que se leen bien sobre fondo claro y oscuro (contraste ≥ 3:1 contra ambos fondos). Se guarda el hex, porque los widgets en Kotlin lo van a necesitar tal cual. No hay selector libre de color. **[mía]**
- El nombre es único según `name_key`. Las archivadas no aparecen en los selectores, pero sus ítems siguen mostrando su color.

### To-do
- Las vistas se filtran **en el cliente** sobre la lista completa. Eso simplifica el offline de la Fase 2. **[mía]**
  - **Hoy:** pendientes con `due_date <= hoy`, con las vencidas arriba y marcadas.
  - **Próximas:** pendientes con `due_date > hoy`, agrupadas por día.
  - **Sin fecha:** pendientes sin `due_date`.
  - **Por materia:** pendientes, filtradas con chips de materia o "Sin materia".
  - **Completadas:** ordenadas por `completed_at` descendente.
- **Orden [mía]:** dentro de un día van primero los ítems con hora, ordenados por hora, y después los sin hora, en orden manual. Se arrastra (long-press) en Hoy, Próximas (dentro de cada día) y Sin fecha, y solo mueve ítems sin hora. En Por materia el orden es por fecha y después por el orden de arriba, sin arrastre. Mover un ítem pone su `sort_order` en el promedio entre sus vecinos.
- **Agregar rápido [mía]:** un campo abajo, al alcance del pulgar. En Hoy pone fecha = hoy; en Por materia, con una materia elegida, le asigna esa materia; en el resto queda sin fecha.
- **Tildar:** un toque. El ítem queda tachado ~1,5 s antes de salir de la vista, así un toque por error se deshace tocando otra vez. **[mía]**
- **Edición completa** en `/todo/:id` y `/todo/nueva` (también son links directos para la Fase 3). Desde ahí se puede borrar.

### Calendario
- Vistas: mes (`dayGridMonth`), semana (`timeGridWeek`) y agenda (lista de los próximos 30 días desde la fecha visible) **[mía]**. URL: `/calendario?vista=&fecha=` (link directo a un día para la Fase 3).
- Tocar un día o una franja abre "nuevo evento" con la fecha y la hora cargadas. Deslizar horizontalmente (más de 50 px y más horizontal que vertical) llama a `prev()` y `next()`, sin pelearse con el scroll vertical de la vista semana. Lo implementa un handler de touch propio, de unas 20 líneas.
- **Exámenes destacados:** `parcial`, `recuperatorio` y `final` se muestran con fondo sólido del color de la materia, texto en negrita y una etiqueta ("PARCIAL"). Los `evento` normales van con fondo tenue.
- **To-dos en el calendario:** son de solo lectura, se marcan como tareas (casilla) y van como "todo el día" si no tienen hora. Las completadas se ven tachadas. Tocar uno abre `/todo/:id`.
- **Eventos:** `end_time` es opcional. Sin fin, se muestra solo el inicio (FullCalendar le dibuja 1 h). **[mía]**
- **Expansión de repeticiones:** dado un rango `[from, to]` y una serie, salen ocurrencias en cada fecha `d` con `d >= start_date`, `d <= repeat_until` (si hay), día de la semana de `d` dentro de `repeat_weekdays` y `d` sin exdate. Las ocurrencias separadas son eventos comunes y salen solas. **[mía]** Los eventos que se repiten son de un solo día (`end_date = start_date`).
- **Editar toda la serie** no toca las ocurrencias que ya separaste. **[mía]**

### Importar plan
- **Parser** (`modules/import/server/parser.ts`, función pura):
  1. Recorre el texto. En cada `{` extrae el bloque balanceado, respetando strings y escapes, intenta `JSON.parse` y se queda con el **primer** objeto que tenga `"studyWorkflow": "plan"`. Los fences de markdown y el texto alrededor quedan afuera solos. **[mía]**
  2. Si no aparece ninguno: error "No encontré un plan en el texto pegado". Si `version` no es `1`: "Versión de plan no soportada (N)". Si `items` falta o está vacío, también es error.
  3. Cada ítem se valida por separado y sus errores no frenan el resto: `tipo` debe ser válido; `fecha` debe ser una fecha real (`2026-02-29` no lo es); `titulo` no puede estar vacío y tiene un máximo de 120 caracteres después de `trim`; `hora` va en formato `HH:MM` entre 00:00 y 23:59; `notas` y `materia` tienen que ser strings. Los campos desconocidos se ignoran.
  4. Materia del ítem = `item.materia ?? plan.materia`. Se compara por `name_key` contra todas las materias, incluidas las archivadas, que aparecen como "(archivada)" en la vista previa.
  5. **Duplicados:** mismo `fecha` + mismo título normalizado + misma materia contra los to-dos (`due_date`) y los eventos no repetidos (`start_date`) que ya existen, y también entre ítems del mismo plan. Van marcados y destildados por defecto. **[mía]** Las ocurrencias de series no cuentan como duplicado.
- Mapeo: `tarea` se convierte en un to-do (`due_date`, `due_time`); el resto, en un evento (`all_day` si no hay `hora`, sin fin).
- **UI:** botón "Importar desde portapapeles" (`navigator.clipboard.readText()`, que anda por HTTPS y localhost) y un textarea siempre visible como alternativa. La vista previa agrupa por día, con el color de la materia, casillas, ítems con error en rojo y sin poder tildarse. Las materias sin resolver se eligen en un selector: "Crear (color)" o "Usar existente". El botón "Guardar N ítems" queda deshabilitado hasta resolver todas.
- **Planes:** lista con título (o "Plan del dd/mm/aaaa"), progreso `4/10 tareas` y cantidad de eventos. Borrar pide confirmación en un diálogo con conteos y dos casillas: "Borrar también las K tareas completadas" (destildada) y "Mantener los exámenes (parcial/recuperatorio/final)" (tildada).
- `docs/formato-importacion.md` documenta el formato v1 tal como está en CLAUDE.md, con las reglas de validación de arriba.

---

## 9. UI y calidad

- Mobile-first, inspirada en Samsung One UI: encabezados grandes, tarjetas redondeadas, acciones al alcance del pulgar, botón "+" flotante. El tema claro u oscuro sale de `prefers-color-scheme` con variables CSS. La dirección visual la defino con el skill `frontend-design` en la implementación. **[mía]**
- Accesibilidad: zonas táctiles de 48 px o más, labels en todos los controles, contraste AA en el texto y foco visible.
- Errores: un error boundary en el shell (nunca pantalla en blanco), un estado de error con "Reintentar" en cada página y un aviso cuando falla un cambio.
- Formularios: fechas con `<input type="date">` y `<input type="time">` nativos (en el celu abren el selector del sistema), mostradas como `dd/mm/aaaa`.

## 10. Tests (Vitest, TDD en dominio y API)

- **Parser de importación:** texto alrededor, fences, varios objetos JSON (gana el primero con la marca), JSON roto, sin marca, versión 2, `items` vacío, fechas inválidas (30/02, 29/02/2026 vs. 29/02/2028), hora 24:00, título de 121 caracteres, campos desconocidos, materia con y sin tildes y mayúsculas, materia inexistente, duplicados contra lo existente y dentro del plan.
- **Repeticiones:** bordes del rango, `repeat_until`, exdates, ocurrencias separadas, días lunes y domingo.
- **Vistas de to-do:** función pura con `today` inyectado; vencidas, borde de medianoche en AR (23:30 AR = 02:30 UTC del día siguiente).
- **API** con `fastify.inject` sobre SQLite `:memory:` y migraciones reales: CRUD de materias, to-do y eventos; validaciones (400); editar o borrar una ocurrencia vs. la serie; commit de importación con su transacción (si algo falla, no queda nada creado); progreso y borrado de planes (con y sin completadas, con y sin mantener exámenes); POST idempotente con el mismo id.
- **Migraciones:** orden, que no se reaplican y que van por módulo.
- **UI:** sin framework de tests. Hay chequeo de tipos y la checklist manual del cierre de fase.

## 11. Deploy

- **Contenedor:** Dockerfile multi-stage (build de Vite, `npm ci --omit=dev`). Corre `node core/server/main.ts` como `1000:1000`, con volumen `/srv/study-workflow:/data` (base `/data/study.sqlite`), puerto `127.0.0.1:${PORT:-8080}:8080`, `restart: unless-stopped` y healthcheck contra `/api/health`. Fastify sirve `/api/*` y, para el resto, el SPA (fallback a `index.html`).
- **Setup inicial (una vez), `scripts/server-setup.sh` por SSH:** crea el repo bare `~/git/study-workflow.git`, el directorio de trabajo `~/apps/study-workflow`, `/srv/study-workflow/backups` y el `tailscale serve --bg` hacia `127.0.0.1:8080`. Los comandos exactos de Tailscale los verifico en la doc.
- **Deploy (`npm run deploy` → `scripts/deploy.mjs`, Node puro, anda igual en PowerShell y Git Bash):**
  1. Verifica que el árbol esté limpio y sea `main`.
  2. `git push` al remoto `deploy` = `ssh://tu-usuario@<host-tailscale>/~/git/study-workflow.git`. El host se lee de `.env.deploy`, que no se commitea.
  3. Por SSH corre `remote-deploy.sh <sha>`: checkout del sha y `docker build -t study-workflow:<sha>`. **Si el build falla, termina con error y no toca el contenedor en marcha.**
  4. Backup de la base: `VACUUM INTO '/data/backups/pre-deploy-<fecha>.sqlite'` dentro del contenedor actual. Se guardan las últimas 10.
  5. `IMAGE_TAG=<sha> docker compose up -d` y health check con reintentos (~30 s).
  6. **Si el health falla:** restaura el backup de la base (por si la migración nueva ya la cambió), vuelve a levantar el tag anterior (guardado en `~/apps/study-workflow/.deployed`) y termina con error. **[mía]** Restaurar podría perder escrituras hechas en esos ~30 s; con un solo usuario es aceptable.
- **README:** correr en local (`npm run dev` → `scripts/dev.mjs` levanta el server y Vite con proxy `/api`), clave SSH en Windows (`ssh-keygen -t ed25519` y copiarla a `authorized_keys` desde PowerShell), setup inicial, deploy, backup y cómo agregar un módulo. Lo del APK se agrega en la Fase 2.

## 12. Para el plan, a verificar con Context7 o la doc
- Estabilidad de `node:sqlite` y del type stripping en la LTS vigente de Node.
- FullCalendar con la versión actual de React: `dateClick` y `select` en touch (`longPressDelay`).
- `@dnd-kit` con TouchSensor y activación con delay.
- Fastify (versión actual): `register` con prefix y `@fastify/static` con fallback SPA.
- `tailscale serve --bg` (sintaxis actual, persistencia después de un reboot).
- Que el puerto 8080 esté libre en `tu-server`, y cuál es el hostname MagicDNS del server. Te lo pregunto o lo consulto por SSH con tu permiso cuando lleguemos al deploy.

## 13. Orden de construcción [tuya]

Prioridad: tener algo usable cuanto antes, porque hay parciales este mes.

1. **Hito A, usable:** núcleo + Materias + To-do + Importar plan + deploy funcionando en el server.
   - **[mía]** Para que importar no pierda los parciales del plan, el Hito A también incluye el **backend básico del Calendario**: la migración completa de `calendar_*` y el servicio (`createMany`, `findByDates`, `deleteByIds`), sin UI ni repeticiones. Los exámenes importados quedan guardados y aparecen cuando llega la UI del calendario. Hasta entonces, la vista previa y la lista de planes muestran los eventos como texto.
2. **Hito B:** el módulo Calendario completo: API de eventos, repeticiones, `/agenda`, UI con FullCalendar, panel de ajustes y to-dos en el calendario.

## 14. Queda a criterio de quien implementa
- Si la edición de eventos es un modal o una ruta propia, el layout exacto de los formularios y los colores concretos de la paleta (respetando el contraste).
- Los nombres internos de funciones y archivos dentro de cada módulo, siempre que se respete el contrato.
- Los textos de la UI, en español rioplatense (voseo).
