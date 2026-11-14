# Study Workflow — CLAUDE.md

App personal para organizar la facultad (ITBA) y mi día: to-do, calendario, materias, exámenes y planes de estudio.
Un solo usuario (yo). Se usa en la compu (navegador) y en el celular Samsung S25 Ultra (APK propio con widgets).
Interfaz en español (Argentina). Zona horaria `America/Argentina/Buenos_Aires`, semana empieza el lunes, fechas `dd/mm/aaaa`.

## Cómo trabajamos

- **Ahorro de créditos (prioridad):**
  - Ejecutá **inline en la sesión**. **Sin subagentes** (ni subagent-driven ni agentes en paralelo): en este proyecto tardaron más, gastaron mucho más y el resultado fue casi igual.
  - **Una sola revisión al final** de cada pedido, no una por tarea.
  - Context7: consultá **una vez por librería** al principio y reusá lo que encontraste. Volvé a consultar solo si un build falla por una firma.
  - No releas archivos completos que ya leíste; leé solo la parte que necesitás.
  - Respuestas cortas entre tareas. Avisame solo si algo falla o si tengo que decidir algo.
- **Flujo:** diseño corto escrito → mi OK → plan → ejecución. Preguntame solo lo que no esté resuelto acá o en `docs/`.
- **Commits** chicos y descriptivos, uno por bloque como mínimo.
- **Al terminar cada pedido, frená:** checklist de prueba (celu y compu), comando de deploy y de APK, y los textos exactos para actualizar mis skills de Claude si cambió algún formato. No arranques lo siguiente sin mi OK.
- Si algo es ambiguo o hay dos caminos razonables, preguntame antes de decidir.
- Ponytail está activo: código mínimo, nada de dependencias "por las dudas". **Excepción: la arquitectura modular es un requisito, no sobreingeniería.**
- Cada dependencia nueva se justifica en una línea en el diseño.

## Stack

- Frontend: React + Vite + TypeScript. Backend: Node 24 (TypeScript con type stripping) + Fastify + `node:sqlite`.
- Deploy: Docker Compose en mi servidor (`npm run deploy`). Un contenedor sirve la API y el frontend.
- Celular: Capacitor 8 (Android) con el frontend adentro (`npm run apk`), widgets nativos en Kotlin + Jetpack Glance.

## Servidor

- Ubuntu Server 24.04, `tu-server.tu-tailnet.ts.net`, usuario `tu-usuario`. Docker + Compose.
- **Sin exposición a internet.** Acceso solo por Tailscale.
- Esta app: `127.0.0.1:8110`, publicada con `tailscale serve` en `https://tu-server.tu-tailnet.ts.net:8443`. Host y puertos salen solo de `.env.deploy`.
- **No tocar** otras apps del server: otra-app (`tailscale serve` 443 → 8100), otra-app (8080) y otras apps.
- Datos en `/srv/study-workflow/` (1000:1000). Backup automático antes de cada deploy.
- Filosofía: self-hosted, sin servicios de terceros, sin costos. Sin login (el acceso ya está limitado a mi tailnet).

## Arquitectura modular (requisito)

Núcleo chico + módulos. Agregar una funcionalidad = una carpeta `modules/<id>/` registrada en `modules/server.ts` y `modules/web.ts`, sin tocar otros módulos. Un módulo no lee tablas de otro: usa su API o servicio. Contrato completo en `docs/modulos.md`.

## Estado actual (ya hecho)

- **Núcleo:** Materias (nombre, sigla, color pastel + tono fuerte de la paleta), Ajustes, Inicio (dashboard armado con tarjetas de los módulos).
- **To-do:** lista unificada; tareas con fecha/hora, materia, categoría (`tarea` | `entrega` | `estudio`), duración estimada, subtareas (JSON en la tarea; tildarlas todas completa la principal) y recordatorio; vistas Hoy, Próximas, Sin fecha, Por materia, Completadas.
- **Calendario:** vista Mes (grilla propia, chips por materia, exámenes en color sólido, detalle del día) y Semana (FullCalendar). Eventos `evento | parcial | recuperatorio | final`, repetición semanal, recordatorio.
- **Finales** (módulo `finals`): fechas posibles por materia (a mano o pegando el JSON de mi skill; formato en `docs/formato-finales.md`, v1, mismo criterio de contrato), combinaciones con filtros y orden, elegir crea los eventos `final` y se puede deshacer.
- **Importar plan:** pegar JSON generado por mi skill de Claude `cargar-app`. Formato y reglas: `docs/formato-importacion.md` (v3). Es un contrato: no lo cambies sin subir `version`, seguir aceptando las anteriores y pasarme el texto exacto de los cambios.
- **APK:** offline con la última copia; sin conexión solo se puede tildar (cola, gana la última escritura). Menú "Compartir" → Importar. Guía en `docs/android.md`.
- **Widget To-do** (Glance): scroll y tildado dentro del widget, cola offline propia. No hay widget ni vista Agenda.
- **Recordatorios:** `reminderMin` (minutos antes) + `reminderInsistent` en tareas y eventos; el celu los programa en nativo (AlarmManager) desde la copia del sync del widget. Selector compartido en `core/web/ReminderField.tsx`.
- **Atrás en el APK:** `MainActivity` llama a `window.swBack()` (`core/web/App.tsx`, regla en `core/web/back.ts`).
- **Estilo (Hito C):** tema oscuro fijo, tarjetas, densidad compacta, esquinas medias, fuente del sistema, animaciones sutiles. Tokens en `core/web/styles.css`. Zonas táctiles ≥ 44–48 px.
- Diseños y planes anteriores: `docs/superpowers/specs/` y `docs/superpowers/plans/`.

## Calidad

- Tests: API y lógica de dominio. UI: lo justo.
- Validar entradas en el backend. Errores visibles en la UI (nunca pantalla en blanco).
- Accesibilidad básica: contraste, tamaños táctiles, labels.
- Actualizar `README.md` y `docs/` cuando cambie el uso.
