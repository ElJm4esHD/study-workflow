# Diseño: destino de sincronización "Google Drive"

Pedido: `docs/pedidos/2026-11-16-google-drive.md`. Base: `docs/superpowers/specs/2026-11-15-local-first-design.md` (sección 4) y `docs/sync.md`.
El motor (`engine.ts` / `SyncCore.kt`) y los módulos no cambian: Drive es otro `SyncTarget` (TS) / `Target` (Kotlin).

## 1. Adaptador Drive (solo archivos en `appDataFolder`)

Todo plano en `appDataFolder` (scope `drive.appdata`), JSON, REST v3 con `fetch` / `HttpURLConnection`:

| Archivo | Contenido | Quién lo escribe |
|---|---|---|
| `epoch-<uuid>.json` | vacío: identifica "esta carpeta" | el primer push si no hay ninguno (si por carrera hay dos, vale el de nombre menor) |
| `log-<hlc>-<deviceId>.json` | `{ records }` (≤ 500, un lote del motor) | cada `push` |
| `snap-<hlc>.json` | `{ records, logs: [nombres incluidos] }` | la compactación |

Los archivos nunca se modifican, solo se crean y se borran: no hace falta ningún bloqueo.

**Cursor** (string, igual en TS y Kotlin porque los dos usan el mismo `meta.cursor` de `sw.db`):
`{"v":1,"e":"<epoch>","s":["snap-…"],"l":["log-…", …]}` = la carpeta, los snapshots y los logs ya aplicados.

**`pull(cursor)`:**
1. Lista todo (`spaces=appDataFolder`, `fields=files(id,name)`, de a 1000). La API no filtra `name >`, así que el filtro se hace en el dispositivo; con la compactación nunca pasan de ~200 archivos.
2. `epoch` distinto del del cursor (alguien borró los datos de la app en Drive, o es otra cuenta) → `reset: 'epoch'`: el motor vuelve a subir todo lo local, sin borrar nada.
3. Los snapshots cambiaron (hubo compactación) → lectura completa: todos los snaps + todos los logs, con `reset: 'purged'` (el motor baja todo y saca lo que ya no está, sin tocar lo sin subir). Con cursor `null` es la misma lectura, sin `reset`.
4. Si no, baja solo los logs que **no están** en `cursor.l`.
5. Pagina de a 50 archivos (`more: true`) para no colgarse con una lectura completa.
6. Si un log da 404 (otro dispositivo compactó en el medio), se reintenta el pull una vez; si sigue, error y se reintenta en el próximo sync. Aplicar un registro dos veces no cambia nada.

**Cambio respecto del diseño anterior:** en vez de "cursor = último nombre + leer con margen de 10 min", el cursor es **el conjunto de logs ya leídos**. Así no importa el desfase de reloj ni que la lista de Drive tarde en mostrar un archivo nuevo: el log se baja apenas aparece, tenga el nombre que tenga. Cuesta unos KB en `meta` (≤ ~200 nombres).

**Compactación** (al final de un pull, si hay > 200 logs): baja snaps + logs, se queda con el HLC mayor por registro, saca marcas de borrado de más de 180 días, sube `snap-<hlc mayor>.json` y **después** borra solo lo que incluyó. Si dos dispositivos compactan a la vez, cada uno borra solo lo que su snapshot ya contiene; un lector que ve dos snaps los junta, y la próxima compactación los une. Pasa una vez cada ~200 cambios subidos.

**`push(records)`:** crea `epoch-*` si no hay y sube `log-<clock.now()>-<deviceId>.json` (multipart).

**Tests:** Drive falso en memoria (`files: Map<nombre, contenido>`, con 404 y listados "atrasados" a pedido). Los casos van en una sección `drive` de `core/shared/sync-cases.json` y los corren vitest y JUnit, como el motor. Además: dos dispositivos sincronizando cruzado, compactación concurrente, epoch borrado, 404 en el medio, y los casos de `sync-cases.json` existentes contra el adaptador.

## 2. Inicio de sesión con Google

Solo scope `https://www.googleapis.com/auth/drive.appdata` (no sensible). Sin client secret en ningún lado. Verificado con la documentación de Google (Context7: Identity y Drive).

**Web: Google Identity Services, modelo de token** (`https://accounts.google.com/gsi/client`, se carga solo en modo Drive).
- Única forma oficial sin secreto en el navegador: Google exige client secret para el flujo con código + PKCE en clientes "Aplicación web", y GIS no renueva solo.
- **Límite que impone Google:** el token dura ~1 h y pedir uno nuevo **requiere un toque del usuario** (abre un popup que se cierra solo si ya diste el permiso). Consecuencia: al abrir la web después de 1 h, o tras 1 h seguida de uso, aparece en el encabezado **"Drive: tocá para reconectar"**. Mientras tanto todo anda y se guarda local; al tocar se sube lo pendiente. El token se guarda en `sessionStorage` con su vencimiento y `login_hint` (el mail) en `prefs`, para no volver a mostrar el selector de cuenta.
- No hay alternativa sin server: cambiarlo implicaría guardar el secreto en algún servidor mío o de un tercero, cosa que el pedido no permite.

**APK: `com.google.android.gms:play-services-auth` (`Identity.getAuthorizationClient`)**. Dependencia nueva, justificación: es la API de Google para tokens de acceso en Android sin secreto (el cliente Android se identifica por paquete + SHA-1) y **renueva sola sin interfaz** si el permiso ya está dado, así que también funciona desde el `SyncWorker`.
- Plugin propio (`GooglePlugin.kt`, ~60 líneas, como `WidgetsPlugin`): `token({ interactive })`. Si hace falta mostrar la pantalla de permiso (`hasResolution()`), lanza el `PendingIntent` desde la actividad; en segundo plano no muestra nada y deja un aviso.
- Si vence o se revoca (te desconectás desde la cuenta de Google): aviso "Volvé a conectar Drive" en el encabezado y en Ajustes. Los cambios locales quedan sin subir y no se pierden.
- No uso plugins de la comunidad para Capacitor: los que hay usan Google Sign-In, que está deprecado, y el plugin propio es más chico.
- Requiere Google Play Services (el S25 lo tiene). En celulares sin Play Services no aparece Drive (se puede usar Mi servidor o Solo este dispositivo).

**IDs de cliente:** web desde `VITE_GOOGLE_CLIENT_ID` (`.env.google`, no se commitea; ejemplo en `.env.google.example`). El APK no necesita ID en el código. El ID termina en el bundle publicado, y es público por diseño.

## 3. Elegir destino y cambiarlo sin perder datos

- Preferencia de **este dispositivo**: `target: 'drive' | 'server' | 'local'`. En la web va en `prefs.ts`; en el APK en `SharedPreferences` (junto a `server`, para que lo lea el worker).
- **Primera apertura** sin destino elegido: pantalla con 3 opciones (Drive "recomendado", Mi servidor + dirección, Solo este dispositivo), antes de la guía. Migración: si ya hay `cursor` o `server` guardado (o sea, mi caso), se toma `server` y no se muestra.
- Ajustes › **Sincronización** (reemplaza "Servidor"): destino actual, cuenta de Drive o dirección, "Sincronizar ahora", "Desconectar".
- **Cambiar de destino** = borrar `cursor` + `markAllDirty()` + sync contra el nuevo destino. Resultado: **unión** de lo local con lo que ya tenga el destino (gana el HLC mayor por registro), sin borrar nada. Si el destino nuevo ya tiene datos, se avisa antes: "Se van a juntar los datos de este dispositivo con los que ya hay en…". El destino viejo no se toca.
- Pasar a "Solo este dispositivo" no borra nada; solo deja de sincronizar.

## 4. Widget y recordatorios en modo Drive (decidís vos)

**A. El sync de fondo en Kotlin también habla con Drive (recomendado).**
- Costo: `DriveTarget.kt` (~150 líneas, el mismo algoritmo que el de TS), los casos `drive` corriendo también en JUnit y el token renovado desde el worker (misma dependencia que el login, así que no suma otra).
- Ganancia: lo que cargás en la compu llega al widget y **dispara los recordatorios** sin abrir la app, igual que hoy con Mi servidor. Y los tildes del widget suben solos.
- Riesgo: dos implementaciones del adaptador que tienen que coincidir (es el mismo esquema que ya usamos para el motor, con casos compartidos).

**B. En modo Drive, el widget se actualiza al abrir la app.**
- Costo: casi nada de código.
- Pérdida: una tarea o evento con recordatorio creado en la compu **no suena en el celu hasta que abras la app**, y los tildes del widget suben recién al abrir la app.

## 5. Web pública en GitHub Pages

- Mismo frontend, `vite build --mode pages`: `base: '/study-workflow/'`, `basename` del router, sin la opción Mi servidor (solo Drive o este dispositivo).
- Sin regla de reescritura en Pages: `404.html` = copia de `index.html` (así anda recargar en `/calendario`).
- Instalable y **sin conexión**: un service worker escrito a mano (~30 líneas: red primero para `index.html`, caché para los assets con hash). Sin `vite-plugin-pwa`.
- `privacidad.html` estática (en español; lo que Google pide: qué guarda, dónde, que yo no accedo, cómo borrar: "Administrar apps" de Drive o "Desconectar" en Ajustes).
- **Publicación (decidís vos):** (a, recomendado) `npm run release` arma el sitio en tu compu, le corre la misma auditoría de datos y lo sube a la rama `gh-pages`. Sin Actions ni secretos en GitHub. (b) GitHub Actions con el ID como variable del repo: se publica solo con cada push, pero queda una segunda forma de build, sin la auditoría local.
- Mi web sigue en mi server con Mi servidor. Si querés también Drive desde tu dominio, hace falta otro origen en el cliente web; ver riesgo 3.

## 6. Riesgos

1. **Web: reconectar con un toque cada ~1 h de uso** (límite de Google, sección 2). En el APK no pasa.
2. **Publicar la app a producción en Google:** `drive.appdata` no es sensible, así que no hay auditoría de seguridad. Pero si la pantalla de consentimiento muestra nombre o logo, Google puede pedir verificar la marca y que el dominio de la página de inicio y la de privacidad sea tuyo (`*.github.io` se verifica en Search Console con un archivo en Pages). Lo confirmo con la documentación actual en `docs/google-cloud.md` (etapa 3).
3. **Origen de tu tailnet en Google Cloud:** el nombre `…ts.net` quedaría registrado en tu proyecto de Google (no es público). Puede que Google no lo acepte como origen autorizado; si no, tu web sigue con Mi servidor y Drive queda en el APK y en Pages.
4. **Cambiar de cuenta de Google** = otra carpeta (`epoch` distinto): se trata como cambio de destino (unión con aviso).
5. **Firma del APK:** el cliente Android va atado al SHA-1. El APK del Release, tu APK personal y el `.next` (otro paquete) necesitan cada uno su cliente, o compartir llave y paquete. Lo detallo en `docs/google-cloud.md`.
6. **Cuotas de Drive:** cada sync = 1 listado + los logs nuevos. Con sync cada 5 min y 2 s después de un cambio, queda muy por debajo de los límites por usuario.
7. **Service worker:** si cachea mal, deja una versión vieja. Por eso red primero para `index.html`, y lo pruebo con un deploy de prueba en Pages.

## Dependencias nuevas

- `play-services-auth` (Android): token de Drive sin secreto y renovación en segundo plano.
- Script GIS de Google (web, en tiempo de ejecución, no npm): única forma oficial de pedir el token en el navegador sin secreto.
- Nada más: Drive por REST con `fetch` / `HttpURLConnection`, service worker propio, sin librerías de Google para JS ni Java.
