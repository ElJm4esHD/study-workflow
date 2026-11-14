# Plan: observaciones 14/11/2026

Diseño: `docs/superpowers/specs/2026-11-14-observaciones-design.md`. Decisiones: sonido A por defecto con tilde "Insistente" (B) por recordatorio; repetición solo en eventos que ya se repiten; subtareas sin offline.

Ejecución inline, un commit por bloque, una revisión al final.

1. **Arreglos**
   - Barra negra (confirmado por adb: action bar de la plataforma, `decor_content_parent`, creada con el tema de lanzamiento): `windowActionBar=false` / `windowNoTitle=true` en los temas.
   - `autoFocus` de "Minutos" solo al tocar "Otra…".
   - `.task-row .title` con `line-clamp: 2`.
   - Atrás: callback en `MainActivity` → `window.swBack()`; `parentOf` en `core/web/back.ts` + test.
   - Ancho compu: To-do (panel fijo + secciones en columnas), Ajustes, Importar, Planes, Evento.
   - Sacar Agenda: widget y vista.
2. **Finales**: módulo `finals` (migración, parser + combinaciones en `shared`, API, página), `docs/formato-finales.md`.
3. **Subtareas**: migración, service, edición, filas, widget, parser v3, docs.
4. **Recordatorios**: `reminder_min` + `reminder_insistent` en tareas y eventos, `ReminderField`, Kotlin (cálculo puro + AlarmManager + receiver + boot), docs.
5. Revisión final, typecheck, tests, APK en el celu, docs y cierre.
