# Study Workflow — CLAUDE.md

App personal para organizar la facultad (ITBA) y mi día: to-do, calendario, materias y parciales.
Un solo usuario (yo). Se usa en la compu (navegador) y en el celular Samsung S25 Ultra (APK propio con widgets).
Interfaz en español (Argentina). Zona horaria `America/Argentina/Buenos_Aires`, semana empieza el lunes, fechas `dd/mm/aaaa`.

## Cómo trabajamos

- Seguí el flujo de Superpowers: brainstorming → diseño escrito → plan → ejecución con revisión entre tareas.
- **Ejecución secuencial.** No uses agentes en paralelo (`dispatching-parallel-agents`): consume mucho y en este proyecto las partes dependen entre sí.
- Trabajá por fases (abajo). **Al terminar cada fase, frená** y decime qué probar y cómo. No arranques la siguiente sin mi OK.
- Antes de usar APIs de Capacitor, Jetpack Glance, Vite, Fastify u otra librería, **consultá la documentación actual con Context7**. No confíes en memoria para versiones o firmas.
- Si algo del diseño es ambiguo o hay dos caminos razonables, preguntame antes de decidir.
- Ponytail está activo: código mínimo, nada de dependencias "por las dudas". **Excepción explícita: la arquitectura modular descrita abajo es un requisito, no sobreingeniería.** No la simplifiques.
- Cada dependencia nueva se justifica en una línea en el diseño.

## Stack

- Frontend: React + Vite + TypeScript.
- Backend: Node + TypeScript, API REST JSON, SQLite (archivo único). Migraciones SQL numeradas y simples.
- Deploy: Docker Compose en mi servidor. Un contenedor sirve la API y el build estático del frontend.
- Celular: Capacitor (Android) envolviendo el mismo frontend, con widgets nativos en Kotlin + Jetpack Glance.

## Servidor (contexto)

- Ubuntu Server 24.04, hostname `tu-server`, IP LAN `192.168.x.x`, acceso `ssh tu-usuario@192.168.x.x`. Docker + Compose instalados (usuario en grupo docker).
- **Sin exposición a internet ni port-forwarding.** Acceso remoto solo por Tailscale (ya instalado en el server y el celu).
- Datos persistentes fuera de Docker en `/srv/study-workflow/`, ownership `1000:1000`. La base SQLite vive ahí.
- HTTPS: usar `tailscale serve` hacia el puerto local del contenedor (bindeado a `127.0.0.1`), con el certificado `*.ts.net` de Tailscale. Verificá en la doc de Tailscale los pasos actuales (MagicDNS + HTTPS certificates habilitados).
- Filosofía: self-hosted, sin servicios de terceros, sin costos. Backup = copiar `/srv/study-workflow/`.
- Sin login en la v1: el acceso ya está limitado a mi tailnet. Dejá el punto de enganche para agregar auth después.

## Arquitectura modular (requisito)

Núcleo chico + módulos. Agregar una funcionalidad nueva = agregar una carpeta de módulo y registrarla, sin tocar los otros módulos.

- **Núcleo:** shell de la app (layout, navegación, tema claro/oscuro según el sistema), registro de módulos, configuración, cliente de API, base de datos y migraciones, y la entidad compartida **Materias**.
- **Contrato de módulo (frontend):** `id`, nombre, ícono, rutas, ítem de navegación, y opcionalmente panel de ajustes. El núcleo arma la navegación a partir del registro.
- **Contrato de módulo (backend):** `id`, rutas bajo `/api/<id>`, sus propias migraciones. Un módulo no lee tablas de otro módulo directamente; usa la API o un servicio expuesto por el núcleo.
- Los módulos se pueden activar/desactivar desde configuración.
- Documentá el contrato en `docs/modulos.md` con un ejemplo mínimo, para que agregar módulos futuros (ej. planificador de finales) sea mecánico.

## Funcionalidades v1

### Materias (núcleo)
- Crear, editar, archivar. Nombre + color (selector con paleta legible en claro y oscuro).
- El color de la materia se usa en to-do, calendario y widgets.

### To-do (módulo)
- Una sola lista unificada. Cada ítem: título, notas (opcional), fecha y hora (opcional), materia (opcional), completado, orden.
- Las tareas de la facultad son ítems con materia; no hay entidad aparte.
- Vistas/filtros: Hoy (incluye vencidas), Próximas, Sin fecha, Por materia, Completadas.
- Agregar rápido (solo título) y edición completa. Tildar/destildar con un toque. Reordenar.
- Inspiración: Samsung Reminder/To-Do. Uso rápido y cómodo en el celu con una mano.

### Calendario (módulo)
- Independiente (sin sincronizar con Google/Samsung en la v1).
- Vistas mes, semana y agenda (lista). Eventos con título, inicio/fin o todo el día, materia (opcional), notas.
- **Tipo de evento:** `evento`, `parcial`, `recuperatorio`, `final`. Los exámenes se destacan visualmente.
- Los to-do con fecha aparecen también en el calendario (lectura; se editan en su módulo).

### Importar plan (módulo)
Armo planes de estudio en chats de Claude (claude.ai, muchas veces desde el celu). Claude me devuelve el plan como JSON y yo lo importo acá, para no cargar cada ejercicio a mano.

- Botón **"Importar desde portapapeles"** (y un campo para pegar a mano como alternativa).
- El texto pegado puede traer texto alrededor (el mensaje entero de Claude): buscá el objeto JSON con `"studyWorkflow": "plan"`, tolerando fences de markdown.
- **Vista previa antes de guardar:** lista por día con el color de la materia, errores por ítem marcados, y posibilidad de destildar ítems. Nada se guarda sin confirmar.
- Materias: se matchean por nombre sin distinguir mayúsculas ni tildes. Si una no existe, la vista previa ofrece crearla (con color) o asignar una existente.
- Duplicados (misma fecha + título + materia que algo ya cargado): se marcan y se omiten por defecto.
- `tipo: "tarea"` → ítem del to-do con fecha. `evento | parcial | recuperatorio | final` → evento del calendario.
- El formato es un contrato con una skill de Claude que lo genera: documentalo en `docs/formato-importacion.md` y no lo cambies sin subir `version` y avisarme.

Formato v1:
```json
{
  "studyWorkflow": "plan",
  "version": 1,
  "titulo": "Preparación 2do parcial",
  "materia": "Álgebra",
  "items": [
    { "tipo": "tarea", "fecha": "2026-11-05", "titulo": "Guía 4: ej. 1 a 6", "notas": "Repasar teoría de autovalores antes" },
    { "tipo": "parcial", "fecha": "2026-11-20", "hora": "09:00", "titulo": "2do parcial" }
  ]
}
```
- `titulo` y `materia` del plan: opcionales. `materia` es la default de los ítems.
- Ítem: `tipo` (obligatorio), `fecha` `YYYY-MM-DD` (obligatoria), `titulo` (obligatorio, ≤ 120 caracteres), `hora` `HH:MM` 24 h (opcional), `notas` (opcional), `materia` (opcional, pisa la del plan). Hora local de Argentina.
- Campos desconocidos se ignoran.

## Celular (APK con Capacitor)

- Instalación manual del APK (sin Play Store). Script de un comando para compilar el APK de debug/release firmado localmente.
- El APK **trae el frontend adentro** (no carga la UI desde el servidor) para que abra sin conexión.
- Offline: mostrar el último estado cacheado; las modificaciones hechas sin conexión se encolan y se sincronizan al reconectar. Conflictos: gana la última escritura (`updatedAt`). Un solo usuario, no hace falta más.
- La URL del servidor (`https://<host>.ts.net`) es configurable. Configurá CORS en el backend para el origen de Capacitor (verificá cuál es en la versión actual).

## Widgets de Android (nativos, Kotlin + Jetpack Glance)

Tienen que ser **interactivos dentro del widget**, como el de Samsung Reminder: scroll y tildado sin abrir la app. Los accesos directos del ícono NO sirven.

1. **Widget To-do:** lista con scroll de pendientes (vencidas + hoy + próximas), checkbox para completar desde el widget, color de materia, botón "+" que abre la app en "nueva tarea", tocar un ítem abre la app en esa tarea.
2. **Widget Agenda:** hoy y próximos 7 días: eventos, parciales y to-do con fecha, con color de materia y exámenes destacados. Scroll. Tocar abre la app en ese día.

- Redimensionables. Tema según el sistema (Material You si es simple).
- Los widgets hablan con la API del servidor; cachean el último estado y encolan los tildados si no hay conexión.
- Se refrescan cuando la app cambia datos y periódicamente.

## Fases

1. **Backend + web:** núcleo, contrato de módulos, Materias, To-do, Calendario, Importar plan. Docker Compose + deploy al server + `tailscale serve`. Tests de API y lógica (incluido el parser de importación con texto alrededor, fechas inválidas, materias inexistentes y duplicados).
2. **APK Capacitor:** empaquetado, URL configurable, caché offline y cola de sincronización. Script de build. Opcional, si es simple y estable: que el APK aparezca en el menú "Compartir" de Android para recibir texto y abrir directo "Importar plan" (verificá el plugin con Context7; si no es confiable, avisame y lo salteamos).
3. **Widgets:** To-do y Agenda en Glance.

## Calidad

- Tests: API y lógica de dominio con TDD. UI: lo justo.
- Validar entradas en el backend. Manejo de errores visible en la UI (sin pantallas en blanco).
- Accesibilidad básica: contraste, tamaños táctiles, labels.
- `README.md` con: correr en local, deploy, compilar e instalar el APK, agregar un módulo.
- Commits chicos y descriptivos.
