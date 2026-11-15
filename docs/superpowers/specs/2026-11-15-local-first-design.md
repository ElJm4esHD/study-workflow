# Diseño: local-first con sincronización (destino "Mi servidor")

Pedido: `docs/pedidos/2026-11-15-local-first.md`. Etapa 1: diseño, sin código.

## Resumen

- Cada dispositivo tiene **todos los datos en memoria** (son pocos: miles de registros) y los persiste localmente. La lógica de cada módulo corre en la app sobre esa memoria, de forma síncrona, igual que hoy corre sobre `node:sqlite`.
- Todo se guarda como **registros**: `{ t: colección, id, data: JSON | null, hlc }`. `data: null` es una marca de borrado.
- Sincronizar = intercambiar registros. Gana el de **HLC** mayor (último cambio por registro). El destino solo guarda y devuelve registros: no conoce módulos ni reglas.
- Sin dependencias nuevas: IndexedDB del navegador, SQLite de Android (vía el plugin propio que ya existe) y un service worker escrito a mano.

## 1. Almacenamiento local

| Dónde | Qué | Dependencia |
|---|---|---|
| Web | IndexedDB (stores `records` y `meta`), sin librería | Ninguna (API del navegador) |
| APK | Archivo SQLite nativo `sw.db` (`android.database.sqlite`), expuesto a JS por `WidgetsPlugin` | Ninguna (Android) |
| Web offline | Service worker propio (~30 líneas) que cachea el shell de la app | Ninguna |

**Por qué SQLite nativo en el APK y no IndexedDB del WebView:** el código Kotlin no puede leer el IndexedDB del WebView. Con SQLite nativo la app, el widget y los recordatorios leen y escriben el **mismo archivo** (requisito 5). Descarté `@capacitor-community/sqlite` (pesado, trae SQLCipher y cosas que no uso): el plugin propio necesita 4 métodos.

Esquema local (igual en los dos):

```
records(t TEXT, id TEXT, data TEXT NULL, hlc TEXT, dirty INTEGER, rev INTEGER, PRIMARY KEY (t, id))
meta(key TEXT PRIMARY KEY, value TEXT)   -- deviceId, cursor, epoch, lastSync
```

- `dirty = 1`: cambio local todavía no subido (reemplaza a la cola actual: la "cola" es la lista de registros sucios).
- `rev`: contador local que sube en cada escritura; sirve para que la app sepa qué cambió el widget o el sync de fondo mientras no miraba (`load(sinceRev)`).

Plugin APK (JS ↔ Kotlin): `load(sinceRev)`, `write(records[])` (transacción), `meta get/set`, evento `changed` cuando escribe el lado nativo.

**Rendimiento:** al arrancar se lee todo de una vez (una llamada a IndexedDB o al plugin) y la UI se dibuja desde memoria; el sync corre después, sin bloquear. Las escrituras van primero a memoria (la UI responde al instante) y se persisten enseguida en segundo plano; al pasar a segundo plano (`visibilitychange`) se espera que terminen. La web pide `navigator.storage.persist()` para que el navegador no la borre.

## 2. Modelo de datos

Cada colección lleva el prefijo del módulo y sus documentos son los mismos objetos camelCase que hoy devuelve la API (así la UI casi no cambia):

| Colección | id | Notas |
|---|---|---|
| `materias` | id actual | núcleo |
| `settings` | la clave | un registro por ajuste: dos ajustes distintos no se pisan |
| `todo_items` | id actual | subtareas siguen adentro |
| `calendar_events` | id actual | `exdates: string[]` pasa adentro del evento (hoy es tabla aparte) |
| `finals_dates` | id actual | |
| `finals_chosen` | materiaId | id determinístico: dos dispositivos que eligen lo mismo caen en el mismo registro |
| `import_plans` | id actual | `items: {type, id}[]` adentro (hoy es tabla aparte) |

Sin FK ni cascadas: el service del módulo borra los hijos a mano (genera una marca por cada uno) y **quien lee tolera referencias colgantes** (una excepción de una serie borrada se ignora; una materia que no está se muestra "sin materia").

Cambios de forma de un documento en el futuro: cada módulo declara `migrate(doc, fromVersion)` que corre al leer; el documento guarda `v`. No hay `ALTER TABLE`.

## 3. Reloj y conflictos (HLC)

Reloj lógico híbrido, guardado como texto que se ordena alfabéticamente:

```
000001763212345678-0003-d7f2a1     = ms (13 díg., con ceros) - contador (4 hex) - nodo
```

- Cambio local: `ms = max(ms_anterior, ahora)`; si es igual al anterior, `contador + 1`.
- Al recibir: `ms = max(ms_local, ms_remoto, ahora)` y el contador se ajusta (algoritmo HLC estándar).
- **Si el reloj del celu va para atrás**, el HLC no retrocede (usa el máximo visto). Si un dispositivo tiene la hora adelantada, sus cambios ganan contra cambios *concurrentes* de otros, pero el orden causal se mantiene (lo que edito después de ver un cambio siempre le gana). Aviso en Ajustes si la hora del dispositivo difiere más de 5 min de la del server (header `Date` de la respuesta; Drive también lo da).
- Nodo: `deviceId` al azar por instalación; el widget usa `deviceId-w` para que la app y el widget nunca generen el mismo HLC.
- Regla de mezcla, una sola en todo el sistema: **se queda el registro de `hlc` mayor**. Empate imposible (el nodo desempata).
- Los registros migrados usan su `updated_at` actual como `ms` y nodo `migr`.

Por registro, como pidió el pedido: si tildo en el celu sin conexión y cambio el título en la compu, gana el cambio más nuevo entero (el otro se pierde). Es lo que ya pasa hoy (hoy gana la compu).

## 4. Protocolo de sincronización

Motor único en `core/web/sync/`. El destino es un adaptador con dos operaciones:

```ts
interface SyncTarget {
  push(records: Rec[]): Promise<void>;                          // "subí estos cambios"
  pull(cursor: string | null): Promise<{ records: Rec[]; cursor: string; more: boolean; reset?: boolean }>;  // "dame lo que cambió desde X"
}
```

Un `sync()`:

1. **Push:** manda los `dirty` (de a 500). Al confirmar, limpia `dirty` solo si el `hlc` no cambió mientras tanto (si edité de nuevo, sigue sucio).
2. **Pull:** pide desde `cursor` hasta `more = false`; aplica cada registro si su `hlc` es mayor que el local; avanza el reloj; guarda `cursor`.
3. Avisa a las pantallas (`reloadAll`) y al widget.

Cuándo: al abrir, al volver la red (`online`), al volver a primer plano, cada 5 min con la app abierta y 2 s después de un cambio local. Indicador en el header: "Sin sincronizar (3)" / "Sincronizado hace 2 min".

**Adaptador "Mi servidor":** una tabla y dos rutas.

```sql
sync_records(t TEXT, id TEXT, data TEXT, hlc TEXT, seq INTEGER, PRIMARY KEY (t, id));  -- índice en seq
-- push: INSERT ... ON CONFLICT DO UPDATE SET ..., seq = <siguiente> WHERE excluded.hlc > sync_records.hlc
```

- `POST /api/sync/push` `{ records }` y `GET /api/sync/pull?since=<seq>&limit=1000` → registros con `seq > since`, `cursor = max seq`.
- El server **solo** valida forma (strings, largo de `t`/`id`, formato de `hlc`, `data` objeto o null, tamaño máximo) y se queda con el HLC mayor. No valida reglas de negocio.
- Como el server se queda solo con la última versión de cada registro, `pull(null)` es la copia completa (dispositivo nuevo).
- `epoch` (uuid de la base del server) viaja en el cursor: si el server se restauró de un backup o cambió, el epoch no coincide y el cliente hace **reset** (ver 5).

**Cómo encaja Drive después (solo con archivos, en `appDataFolder`):**

- Cada push sube un archivo `log/<hlc>-<deviceId>.json` con los registros.
- Pull: listar `log/` con nombre mayor que el cursor (el cursor es el último nombre visto; los nombres se ordenan por HLC). Para "dame lo que cambió desde X" no hace falta lógica del lado del server.
- Compactación: cuando hay más de 200 archivos, el dispositivo que sincroniza escribe `snapshot-<hlc>.json` (estado mezclado) y borra los logs anteriores; un cursor más viejo que el snapshot → reset desde el snapshot.
- Riesgo conocido para ese pedido: relojes muy adelantados pueden dejar un log con nombre "en el futuro" que otro ya pasó; se resuelve leyendo con margen (cursor menos 10 min) porque aplicar un registro dos veces no cambia nada.

## 5. Borrados

- Borrar = registro con `data: null` y HLC nuevo (marca). Viaja como cualquier cambio, así que un dispositivo que estuvo sin conexión no puede revivir algo borrado (su copia vieja tiene HLC menor).
- "Deshacer" = volver a escribir el documento con un HLC nuevo.
- **Limpieza:** el server borra marcas con más de **180 días** (por el `ms` del HLC) en el arranque y guarda `purgedSeq` (el mayor `seq` limpiado). En el dispositivo, una marca ya subida (`dirty = 0`) con más de 180 días se borra al sincronizar.
- Si un dispositivo pide `since < purgedSeq` (estuvo más de 180 días sin sincronizar) o el epoch cambió → **reset**: baja todo, borra los registros locales no sucios que no vinieron y conserva los sucios para subirlos. Límite aceptado: una edición hecha en ese dispositivo a algo borrado hace más de 180 días lo revive.

## 6. Widget y recordatorios

- Leen `sw.db` directo (`records` de `todo_items`, `calendar_events`, `materias`, `settings`). Desaparecen las copias en SharedPreferences y la cola propia del widget.
- **Tildar en el widget:** en una transacción, reescribe el documento con la misma regla que `todo.setCompleted` (`completed`, `completedAt`, `updatedAt`), HLC nuevo con nodo `-w`, `dirty = 1`. Avisa a la app (evento `changed`) y programa un sync.
- **Sync de fondo en Kotlin** (WorkManager, como hoy): un mini motor solo para "Mi servidor" (push de sucios, pull, misma regla de HLC mayor). Para que no se desvíe del de JS, los dos corren el **mismo archivo de casos** (`core/shared/sync-cases.json`) en vitest y en JUnit. Así los cambios hechos en la compu siguen llegando al widget y a las alarmas sin abrir la app.
- **Recordatorios de eventos repetidos:** hoy el server expande las repeticiones. Paso `seriesDates` (29 líneas) a Kotlin con casos compartidos con el de TS (mismo archivo de casos).
- Acento, tema y `server` siguen en SharedPreferences (son de "este dispositivo").

## 7. Módulos (`docs/modulos.md`)

Cada módulo sigue siendo una carpeta y se lleva sus datos y su lógica. Cambia el contrato del lado "server", que pasa a correr en la app:

```
modules/<id>/
  app/index.ts     # AppModule: colecciones, rutas locales, service, search  (antes server/index.ts)
  app/*.ts         # lógica (la misma de hoy, sobre colecciones en vez de SQL)
  web/index.tsx    # WebModule (igual que hoy)
```

```ts
interface AppModule {
  id: string; requires?: string[];
  collections: string[];                          // con prefijo del módulo
  routes(r: LocalRouter, ctx: AppContext): void;  // mismas rutas de hoy: '/api/todo', '/api/todo/:id'…
  service?(ctx: AppContext): object;
  search?(ctx: AppContext, q: string): SearchHit[];
}
interface AppContext { col<T>(name): Collection<T>; transaction(fn); materias; settings; modules; services; now(); }
interface Collection<T> { all(): T[]; get(id): T | undefined; put(doc: T): void; remove(id): void; }
```

- **`api()` se queda como fachada**: `api('GET', '/api/todo')` ya no hace `fetch`, resuelve contra el router local. Las páginas y `useApi` no cambian; el sync dispara `reloadAll`. Se borran `offline.ts`, la cola, las copias y `useBlock` (ya no hay acciones bloqueadas sin red).
- La validación que hoy hacen los JSON Schema de Fastify pasa a los services del módulo (la entrada sigue validándose, ahora en la app).
- Búsqueda global y backup pasan a la app: el backup exporta todos los registros (formato `study-workflow-backup` v2) y sigue aceptando el v1 actual (lo convierte con el mismo conversor de la migración).
- Formatos de importación `plan` v3 y `finales` v1: **sin cambios**; el parser se mueve con su módulo.
- El server pierde `modules/server.ts` y las rutas de módulos: queda `/api/health`, `/api/sync/*` y el estático.

## 8. Migración y convivencia

**Versión nueva en paralelo, sin tocar la actual:**

| | Actual (1.1.x) | Nueva (2.0.0) en prueba |
|---|---|---|
| Contenedor | `study-workflow` (compose project actual) | `study-workflow-next` |
| Puerto | `PORT` / `HTTPS_PORT` | `PORT_NEXT` / `HTTPS_PORT_NEXT` en `.env.deploy` (p. ej. 8111 / 8444) |
| Datos | `/srv/study-workflow/study.sqlite` | `/srv/study-workflow-next/sync.sqlite` |
| APK | `ar.federico.studyworkflow` | `ar.federico.studyworkflow.next`, nombre "Study (nuevo)", widget propio |
| Comando | `npm run deploy` | `npm run deploy -- --next`, `npm run apk -- --next` |

Las dos apps se pueden instalar a la vez en el S25.

**Pasos:**

1. **Backup completo** de la base actual (`VACUUM INTO` + `GET /api/backup`), bajado a la compu fuera del repo.
2. **Conversor** `scripts/migrar-local-first.mjs <backup-v1.json>` → registros. Corre sobre la **copia** y escribe un reporte:
   `materias, tareas, subtareas, eventos, excepciones de series, planes (e ítems), fechas de finales, elegidas, ajustes, recordatorios (tareas + eventos)` — antes / después / ✓. Si algo no coincide, sale con error.
3. Cargar el resultado en `study-workflow-next` (push del lote) y verificar con la web nueva y el APK `.next` (checklist de la etapa 5). Durante la prueba **la versión actual sigue siendo la real**: lo que cargue en la nueva es de prueba.
4. **Corte con tu OK:** dejo de usar la actual → backup nuevo → conversor de nuevo (son minutos) → deploy 2.0.0 en el puerto de siempre con `sync.sqlite` (el `study.sqlite` viejo queda intacto al lado) → instalar APK 2.0.0 encima del actual → desinstalar `.next` y bajar `study-workflow-next`.
5. Al instalar el APK 2.0.0 encima del 1.x, si quedaron tildes en las colas viejas (`sw.queue` de la app o la del widget), se aplican como cambios locales después del primer pull (no se pierden).

**Vuelta atrás** (en `docs/` al implementar):

- Antes del corte: no hay nada que volver atrás (la actual no se tocó).
- Después del corte: `IMAGE_TAG=1.1.1 npm run deploy` levanta la imagen vieja sobre el `study.sqlite` intacto; reinstalar el APK 1.1.1 del release de GitHub. Para no perder lo hecho en 2.0: el conversor tiene la vuelta (`--a-v1`: registros → backup v1) y se restaura con `POST /api/backup` en la 1.1.1.

## 9. Versiones

Cada etapa sube a `2.0.0-beta.N` con su entrada en Novedades (solo se deploya en `next`); el corte publica `2.0.0`. Cambio de mayor porque la API del server cambia por completo (un APK 1.x contra un server 2.0 deja de andar).

## 10. Riesgos

1. **Pérdida de datos en la migración** → conversor con reporte que corta si no coinciden, base vieja intacta, vuelta atrás con conversor inverso.
2. **Último cambio por registro pisa ediciones concurrentes** del mismo registro (ver 3). Aceptado por el pedido; pasar a "por campo" más adelante es compatible (agregar HLC por campo en el documento).
3. **Reloj de un dispositivo muy adelantado**: sus cambios concurrentes ganan. Mitigado con el aviso de hora en Ajustes.
4. **Dos motores (JS y Kotlin)** pueden desviarse → archivo de casos compartido corrido por los dos tests; el de Kotlin es solo "Mi servidor".
5. **Unicidad** (nombre de materia): dos dispositivos sin conexión que crean la misma materia generan dos. Raro con un usuario; se archiva una a mano.
6. **Concurrencia en `sw.db`** entre la app, el widget y el worker → un solo `SQLiteOpenHelper` en el proceso, WAL, escrituras en transacción.
7. **El navegador puede borrar IndexedDB** (poco espacio o borrar datos del sitio) → `storage.persist()`; el server tiene todo, se pierde solo lo no subido. El indicador muestra cuántos cambios faltan subir.
8. **Escritura en memoria antes de persistir**: si la app muere en esos milisegundos se pierde el último cambio. Se espera la persistencia al pasar a segundo plano.
9. **Etapa 3 es la más grande** (pasar cada service de SQL a colecciones); por eso va de a un módulo, con los tests actuales de cada service portados.
10. **Arranque con muchos datos:** con 10.000 registros la carga inicial sigue siendo una sola lectura; si algún día molesta, se cargan las tareas completadas viejas a demanda.

## Preguntas abiertas

1. **Fachada `api()` con router local** (recomendado: las páginas no cambian) **o** llamadas tipadas a los services desde las páginas (más prolijo, mucho más diff). 
2. **Sync de fondo en Kotlin** para que el widget y las alarmas se enteren de cambios hechos en la compu sin abrir la app (recomendado, mini motor duplicado con casos compartidos) **o** sin sync de fondo (el widget se actualiza solo al abrir la app: más simple, pero empeora lo de hoy).
3. **Limpieza de marcas a 180 días** ¿te sirve, o preferís otro plazo?
