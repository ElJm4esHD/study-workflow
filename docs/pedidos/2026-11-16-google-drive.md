# Pedido: destino de sincronización "Google Drive"

## Objetivo

Que **cualquier persona** pueda usar la app en la compu y en el celu **sin tener un server**: sus datos se sincronizan a través de **su propio Google Drive**, en la carpeta oculta de la app (`appDataFolder`, scope `drive.appdata`, no sensible). Yo sigo usando "Mi servidor" como hasta ahora.

Base: el diseño local-first (`docs/superpowers/specs/2026-11-15-local-first-design.md`), que ya esboza cómo encaja Drive (logs por push, snapshot de compactación, cursor por nombre). Drive tiene que ser **un adaptador más** del motor de sincronización, sin tocar la lógica de los módulos.

## Etapa 0: limpieza y publicación de la 2.0.0 (antes de Drive)

1. Bajá la versión de prueba del server: `docker compose -p study-workflow-next down`, sacá el `tailscale serve` del puerto 8444 (sin tocar el 443 de mis otras apps ni el 8443) y borrá `/srv/study-workflow-next`. Confirmá con `tailscale serve status`.
2. **No borres** la base vieja `study.sqlite` ni los backups.
3. `npm run release` con su auditoría de datos (0 resultados) y el APK público, y pusheá a GitHub.

Frená y mostrame el resultado.

## Requisitos de Drive

1. **Primera apertura (web y APK):** elegir dónde se guardan los datos: **Google Drive** (recomendado para la mayoría), **Mi servidor** (con la dirección) o **Solo este dispositivo** (sin sincronizar). Se puede cambiar después en Ajustes; al cambiar, los datos locales se suben al destino nuevo sin perder nada.
2. **Adaptador Drive** con el mismo contrato `SyncTarget` (push y pull con cursor), solo con archivos en `appDataFolder`: logs por push, snapshot de compactación, reset cuando el cursor quedó atrás, y lectura con margen por relojes desfasados (ver el diseño). Tests con un Drive falso en memoria, más los casos de `sync-cases.json`.
3. **Inicio de sesión con Google:** en la web y en el APK, pidiendo **solo** `drive.appdata` (más lo básico de identidad si hace falta). La sesión se renueva sola; si vence, aviso claro y un botón para volver a entrar, sin perder los cambios locales. **Sin secretos en el código público:** nada de client secret en la web ni en el APK.
4. **Widget y recordatorios en modo Drive:** proponé si el sync de fondo en Kotlin también habla con Drive o si en ese modo el widget se actualiza al abrir la app. Explicame el costo de cada opción.
5. **Web pública en GitHub Pages:** la misma app, sin server, con el modo Drive o "Solo este dispositivo". Instalable como app de escritorio. Mi web sigue en mi server.
6. **APK público** (el del Release): arranca en la pantalla de elegir destino.
7. **Página de privacidad** en GitHub Pages: qué datos guarda la app (solo en el dispositivo y en el Drive del usuario), que yo no tengo acceso a nada y cómo borrar los datos. Google la pide para publicar la app.

## Configuración de Google (la hago yo, guiame)

Escribí `docs/google-cloud.md` paso a paso para alguien que nunca lo hizo: crear el proyecto, habilitar la Drive API, configurar la pantalla de consentimiento (con los links a la página de inicio y de privacidad), crear los clientes OAuth (web para GitHub Pages y para mi dominio, y Android con el SHA-1 de mi llave de firma) y **publicar la app a producción**, para que los permisos no venzan a los 7 días como en el modo prueba. Verificá con la documentación actual de Google cada paso y cada nombre de menú.

## Seguridad

- Ningún dato del usuario pasa por mi server ni por ningún servicio mío.
- Los IDs de cliente OAuth son públicos por diseño, pero que salgan de configuración y no queden datos míos en el repo.
- Auditoría de datos (la de `npm run release`) antes de cada publicación.

## Cómo trabajar

Etapas, **frenando en cada una** con qué probar:

0. Limpieza y release de la 2.0.0 (arriba).
1. **Diseño** (sin código): adaptador Drive, login web y Android (librerías con justificación y verificadas con Context7), pantalla de elegir destino, cambio de destino sin perder datos, widget en modo Drive, GitHub Pages y riesgos.
2. Adaptador Drive + tests con Drive falso.
3. Login y modo Drive en la web + GitHub Pages + página de privacidad. Acá me guiás con `docs/google-cloud.md` para crear el proyecto.
4. Login y modo Drive en el APK + widget + recordatorios.
5. Pantalla de elegir destino, cambio de destino, README actualizado ("Usala sin server") y release.

Reglas: sin subagentes, una sola revisión al final de cada etapa, Context7 una vez por librería, respuestas cortas, versión nueva con su entrada en Novedades. El trabajo va en una rama `google-drive`; `main` queda en la versión estable hasta el merge con mi OK.
