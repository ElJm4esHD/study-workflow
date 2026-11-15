# Sincronización (local-first)

Diseño: `docs/superpowers/specs/2026-11-15-local-first-design.md`. Esta es la referencia del código.

- **Registro**: `{ t: colección, id, data: objeto | null, hlc }`. `data: null` = marca de borrado.
- **HLC** (`core/shared/sync.ts`): `ms(13)-contador(4 hex)-nodo`, se ordena como texto; se queda el mayor. No retrocede aunque el reloj del dispositivo lo haga.
- **Base local** (`core/web/sync/db.ts`): todo en memoria + un `LocalStore` (`stores.ts`: IndexedDB; en memoria como respaldo y para tests). `dirty` = pendiente de subir.
- **Motor** (`core/web/sync/engine.ts`): `sync(db, target)` sube lo sucio (de a 500) y baja desde el cursor. `SyncTarget` = `push(records)` + `pull(cursor)`: es lo único que cambia entre destinos.
- **Mi servidor** (`core/server/sync.ts`, tabla `sync_records`): `POST /api/sync/push`, `GET /api/sync/pull?since=<cursor>&limit=`. Solo valida forma. Cursor = `epoch:seq:purgado`; si cambió el epoch o el cliente quedó atrás de una limpieza, la respuesta trae `reset: true` y el cliente baja todo y descarta lo que el server ya no tiene (conserva lo sucio).
- **Marcas de borrado**: se limpian a los 180 días (server al arrancar y una vez por día; dispositivo al sincronizar).

Etapa 2: nada de esto está conectado a las pantallas todavía (eso es la etapa 3).
