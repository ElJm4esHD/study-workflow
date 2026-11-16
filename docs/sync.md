# Sincronización (local-first)

Diseño: `docs/superpowers/specs/2026-11-15-local-first-design.md`. Esta es la referencia del código.

- **Registro**: `{ t: colección, id, data: objeto | null, hlc }`. `data: null` = marca de borrado.
- **HLC** (`core/shared/sync.ts`): `ms(13)-contador(4 hex)-nodo`, se ordena como texto; se queda el mayor. No retrocede aunque el reloj del dispositivo lo haga.
- **Base local** (`core/web/sync/db.ts`): todo en memoria + un `LocalStore` (`stores.ts`: IndexedDB; en memoria como respaldo y para tests). `dirty` = pendiente de subir.
- **Motor** (`core/web/sync/engine.ts`): `sync(db, target)` sube lo sucio (de a 500) y baja desde el cursor. `SyncTarget` = `push(records)` + `pull(cursor)`: es lo único que cambia entre destinos.
- **Mi servidor** (`core/server/sync.ts`, tabla `sync_records`): `POST /api/sync/push`, `GET /api/sync/pull?since=<cursor>&limit=`. Solo valida forma. Cursor = `epoch:seq:purgado`; si cambió el epoch o el cliente quedó atrás de una limpieza, la respuesta trae `reset: true` y el cliente baja todo y descarta lo que el server ya no tiene (conserva lo sucio).
- **Marcas de borrado**: se limpian a los 180 días (server al arrancar y una vez por día; dispositivo al sincronizar).

- **Cómo se conecta** (`core/web/local.ts`, `core/web/sync/auto.ts`): al arrancar se abre la base local y se arma el "server local" (`core/app/`); `api()` resuelve ahí. La sincronización corre al abrir, al volver la red o a primer plano, cada 5 min y 2 s después de un cambio. En un dispositivo sin datos se espera (hasta 8 s) la primera bajada.
- **Reset**: `reset: 'purged'` (el dispositivo se quedó atrás de una limpieza) baja todo y descarta lo que el server ya no tiene, sin tocar lo sin subir; `reset: 'epoch'` (otro server o base restaurada) **no borra nada local**: vuelve a subir todo lo del dispositivo.
- La web sincroniza con su propio origen; el APK, con la dirección de Ajustes › Servidor (sin dirección anda solo local).

- **Google Drive** (`core/web/sync/drive.ts`, diseño en `docs/superpowers/specs/2026-11-16-google-drive-design.md`): `driveTarget(DriveFiles)` con archivos que nunca se modifican en `appDataFolder` (`epoch-*`, `log-<hlc>-*`, `snap-<hlc>-<p|n>`). El cursor es el conjunto de archivos ya leídos, no un reloj. Compacta a partir de 200 logs. `driveRest(token)` es la `DriveFiles` real (REST v3). Tests con un Drive en memoria: `drive.test.ts`. **Web** (`core/web/sync/google.ts`): login con Google Identity Services (token de ~1 h, sin secreto; renovar pide un toque: `needsAuth` → botón Reconectar en `SyncBar`), `targetKind()` elige destino (en el build de Pages: Drive o local; en mi web: server). Build `vite build --mode pages` (`npm run pages`). **APK** (etapa 4): `DriveTarget.kt` (mismo algoritmo; los casos `drive` de `core/shared/sync-cases.json` los corren `cases.test.ts` y `SyncCasesTest`), `GoogleAuth.kt` + `GooglePlugin.kt` (`Identity.getAuthorizationClient`: token sin interfaz si el permiso ya está dado; la pantalla de permiso sale de `MainActivity.launchGoogle`). El destino lo fija la app con `Widgets.setTarget` (`server` | `drive` | `local`) y `SyncWorker` lo lee. Si Google pide reconectar, el worker no reintenta (`AuthException`). Falta la pantalla de elegir destino (etapa 5).

## En el APK (etapa 4)

- **Almacenamiento:** `sw.db` (SQLite nativo, WAL) en vez de IndexedDB. La app lo usa por el plugin Widgets (`dbLoad` al arrancar, `dbApply` en cada cambio; `core/web/sync/nativeStore.ts`); el widget, los recordatorios y el sync de fondo lo leen y escriben directo (`SwDb.kt`). Un guardado solo pisa una fila si su HLC no es menor.
- **Widget:** tildar escribe en `sw.db` (misma regla que `todo.update({ completed })`: `completed`, `completedAt`, `updatedAt`) con un HLC de nodo `<dispositivo>-w` y la fila sin subir; después un trabajo de WorkManager sincroniza. Desaparecen las copias en SharedPreferences y la cola.
- **Sync de fondo** (`SyncCore.kt`, `SyncWorker`): mismo algoritmo que el de JavaScript, solo para "Mi servidor". Los dos corren `core/shared/sync-cases.json` (`cases.test.ts` y `SyncCasesTest`); si se cambia una regla hay que cambiarla ahí y que pasen los dos.
- **App y nativo a la vez:** cuando el widget o el sync de fondo escriben, el plugin avisa (`dbChanged`) y la app vuelve a leer y toma lo de HLC mayor (`LocalDb.refreshFromStore`); también lo hace al volver a primer plano.
- **Recordatorios:** se calculan de `sw.db` (tareas, eventos y las ocurrencias de las series de los próximos 30 días; `seriesDates` está portado a Kotlin con casos compartidos).
- **Prueba:** `npm run apk -- --next` arma una app aparte ("Study (nuevo)", `.next`), con depuración del WebView y tráfico http (para probar contra un server local con `adb reverse`). Tests: `gradlew testDebugUnitTest` y, con el celu conectado, `gradlew connectedDebugAndroidTest -PswNext=1`.
