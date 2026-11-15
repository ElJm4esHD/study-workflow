# Migración 1.x → 2.0 (local-first)

La 2.0 guarda y calcula todo en el dispositivo y el server solo sincroniza ([sync.md](sync.md)). Esta guía pasa tus datos de la 1.x a la 2.0 sin tocar la versión que usás todos los días hasta que vos decidas el corte.

Las dos versiones conviven:

| | Actual (1.x) | Prueba (2.0.0-beta) |
|---|---|---|
| Rama | `main` | `local-first` |
| Contenedor | `study-workflow` | `study-workflow-next` |
| Puertos (`.env.deploy`) | `PORT` / `HTTPS_PORT` | `PORT_NEXT` / `HTTPS_PORT_NEXT` (p. ej. 8111 / 8444) |
| Datos en el server | `/srv/study-workflow/study.sqlite` | `/srv/study-workflow-next/sync.sqlite` |
| APK | `ar.federico.studyworkflow` | `ar.federico.studyworkflow.next` ("Study (nuevo)") |
| Deploy / APK | `npm run deploy` / `npm run apk` | `npm run deploy -- --next` / `npm run apk -- --next` |

`npm run deploy` (sin flags) sigue saliendo solo de `main`: si hace falta un arreglo en la 1.x, se hace ahí. `--next` solo acepta otra rama y publica en su propia referencia (`next`) del repo del server, así que nunca pisa `main`.

## 1. Preparar la versión de prueba (una vez)

1. En `.env.deploy` agregá `PORT_NEXT` y `HTTPS_PORT_NEXT` (ver `.env.deploy.example`).
2. `npm run server-setup -- --next` (crea las carpetas; avisa si falta algo).
3. En el server, una vez: `sudo tailscale serve --bg --https=<HTTPS_PORT_NEXT> http://127.0.0.1:<PORT_NEXT>` (no toca lo que ya publica `tailscale serve` en otros puertos).
4. `npm run deploy -- --next` desde la rama `local-first`.

## 2. Backup y conversión (con tus datos)

Los archivos con tus datos van **fuera del repo** (por ejemplo en `%USERPROFILE%\.study-workflow\backups`).

1. Backup de la base actual: `GET https://<server>:<HTTPS_PORT>/api/backup` (guardalo como `backup-v1-AAAAMMDD.json`). Además, `npm run deploy` ya hace solo una copia de la base antes de cada deploy, en `/srv/study-workflow/backups/`.
2. Convertir (no toca nada, solo lee el archivo y muestra el informe):

   ```
   node scripts/migrar-local-first.mjs <backup-v1.json>
   ```

   El informe compara cantidades **antes / después** de materias, tareas (y completadas), subtareas, eventos (y series, y excepciones), planes e ítems, fechas y finales elegidos, ajustes y recordatorios, y además verifica la **ida y vuelta** (v1 → v2 → v1 tiene que dar las mismas filas). Si algo no coincide, sale con error y no escribe ni carga nada.
3. Cargar en el server de prueba (rechaza servers 1.x, así que no se puede cargar por error en el real):

   ```
   node scripts/migrar-local-first.mjs <backup-v1.json> --cargar https://<server>:<HTTPS_PORT_NEXT>
   ```

   Verifica que el server tenga todos los registros. Se puede repetir las veces que haga falta: cargar dos veces lo mismo no cambia nada.
4. Probar con la web de prueba (`https://<server>:<HTTPS_PORT_NEXT>`) y el APK `npm run apk -- --next` (instalado al lado del real). **Lo que cargues o cambies ahí es de prueba**: la versión real sigue siendo la 1.x.

## 3. Corte (con tu OK)

1. Dejá de usar la app actual. Si en el celu quedaron tildes sin subir, abrí la app actual con red para que se sincronicen.
2. Backup nuevo (paso 2.1) y conversión de nuevo (son segundos).
3. Mergear `local-first` en `main` y `npm run deploy`: la 2.0.0 sale en el puerto de siempre con `sync.sqlite` (el `study.sqlite` de la 1.x queda intacto al lado). El deploy hace su backup previo como siempre.
4. Cargar en el server real: `node scripts/migrar-local-first.mjs <backup-v1.json> --cargar https://<server>:<HTTPS_PORT>`.
5. Instalar el APK 2.0.0 (`npm run apk`) **encima** de la 1.x; abrir una vez con Tailscale prendido para que baje todo.
6. Desinstalar "Study (nuevo)" y bajar el contenedor de prueba (`docker compose -p study-workflow-next down` en el server) cuando quieras.

## 4. Vuelta atrás

- **Antes del corte:** no hay nada que volver atrás: la real no se tocó. Para tirar la prueba, `docker compose -p study-workflow-next down` y borrar `/srv/study-workflow-next`.
- **Después del corte, sin cambios nuevos que conservar:** volver `main` al commit de la 1.1.1 (`git revert` del merge) y `npm run deploy`: levanta la 1.1.1 sobre el `study.sqlite` intacto. Reinstalar el APK 1.1.1 del release de GitHub.
- **Después del corte, conservando lo hecho en la 2.0:** exportar el backup v2 desde la app (Ajustes › Datos) y convertirlo:

  ```
  node scripts/migrar-local-first.mjs --a-v1 <backup-v2.json> --out backup-v1.json
  ```

  Levantar la 1.1.1 como arriba y restaurar: `curl -X POST -H "Content-Type: application/json" --data @backup-v1.json https://<server>:<HTTPS_PORT>/api/backup`.

## Qué cambia de forma

Cada tabla pasa a una colección de documentos (ver [modulos.md](modulos.md)): lo que era una tabla hija (subtareas, excepciones de una serie, ítems de un plan) va adentro de su documento; `finals_chosen` usa el id de la materia. Las materias fuera de paleta o sin sigla se arreglan al convertir (el informe de ida y vuelta lo marca). Los registros migrados llevan como HLC su `updated_at` (o `created_at`) con nodo `migr`: cualquier cambio posterior, en cualquier dispositivo, gana.
