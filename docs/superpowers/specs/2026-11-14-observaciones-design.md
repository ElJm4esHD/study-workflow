# Diseño: observaciones de uso (14/11/2026)

Pedido: `docs/pedidos/2026-11-14-observaciones.md`. Cuatro bloques, un commit por bloque como mínimo. **Sin dependencias nuevas.**

## Bloque 1: arreglos

1. **Barra negra en el APK.** Por el código es una action bar nativa (muestra el `android:label` de la activity) dibujada encima del WebView; no viene de la web. La causa exacta la confirmo en el celu por `adb` antes de tocar. Arreglo: tema sin action bar en todos los estilos, sin `label` propio en la activity y, si hace falta, mover `EdgeToEdge.enable` después de `super.onCreate`.
2. **Teclado al editar.** El campo "Minutos" (duración "Otra…") tiene `autoFocus` y se monta solo cuando la tarea ya tiene una duración personalizada. Queda con foco solo cuando tocás "Otra…". Al crear una tarea nueva el título sigue con foco.
3. **Títulos en 2 líneas.** `.task-row .title` pasa a `line-clamp: 2` (To-do, tarjeta Hoy y detalle del día).
4. **Botón Atrás.** Hoy Capacitor no maneja Atrás: siempre sale de la app. Agrego ~10 líneas en `MainActivity` que le preguntan a la web, y en el núcleo la regla:
   - hay historial dentro de la app → vuelve atrás;
   - no hay historial y la ruta tiene padre (`/todo/:id` → `/todo`, `/calendario/evento/:id` → `/calendario`) → va al padre;
   - pantalla principal sin historial → minimiza la app.
   El detalle de un día siempre se abre con historial, así que Atrás lo cierra. Función pura `parentOf` con test. No uso `@capacitor/app`: son pocas líneas.
5. **Ancho en la compu** (solo CSS/layout, ≥ 1024 px; el celu no cambia):
   - **To-do:** panel derecho siempre visible (edición de la tarea elegida o, si no hay ninguna, "Nueva tarea"); las secciones de la lista (Vencidas, Hoy, días, materias) se acomodan en columnas cuando entran.
   - **Ajustes:** las tarjetas en grilla de 2–3 columnas.
   - **Importar:** pegar a la izquierda, vista previa a la derecha. **Planes:** grilla de tarjetas.
   - **Evento (crear/editar):** formulario en dos columnas.
   - **Inicio y Calendario** ya usan dos columnas; ajusto solo si queda hueco.
   Lo verifico con capturas a 1440 px.
6. **Sacar la Agenda.** Se van el widget Agenda (clase, receiver, xml, string, lógica y tests) y la vista Agenda del calendario (con el plugin `list` de FullCalendar). El endpoint `/api/calendar/agenda` queda: lo usan Mes, Semana e Inicio. Si tenés el widget Agenda puesto, va a quedar roto: hay que quitarlo a mano de la pantalla.

## Bloque 2: planificador de finales (módulo `finals`, ruta `/finales`)

**Datos**
- `finals_dates(id, materia_id, date, time NULL)`: fechas posibles por materia.
- `finals_chosen(materia_id, event_id)`: eventos creados por la combinación elegida, para poder deshacer.
- Qué materias rindo, filtros y orden se guardan en los ajustes del server (`finals.*`), así compu y celu ven lo mismo.

**Formato de importación** (contrato nuevo, `docs/formato-finales.md`, v1):

```json
{
  "studyWorkflow": "finales",
  "version": 1,
  "materias": [
    { "materia": "Álgebra", "fechas": [ { "fecha": "2026-12-03", "hora": "09:00" }, { "fecha": "2026-12-10" } ] }
  ]
}
```

- Mismo criterio que planes: se puede pegar el mensaje entero, `fecha` `YYYY-MM-DD` real, `hora` `HH:MM` opcional, campos desconocidos se ignoran.
- En Finales → "Importar fechas": pegar → vista previa (materias, fechas, errores) → confirmar. La materia se matchea por nombre o sigla; si no matchea, en la vista previa elegís a cuál corresponde o la salteás.
- Importar **reemplaza** las fechas de las materias que vienen en el JSON; las demás no se tocan.
- A mano: por materia, agregar, editar y borrar fechas.

**Pantalla**
- **Fechas:** una tarjeta por materia (su color), tilde "Rindo" y sus fechas.
- **Filtros:** mínimo de días entre finales, terminar antes de una fecha, excluir fechas o rangos. **Orden:** más días entre finales, termina antes, empieza más tarde.
- **Combinaciones:** una fila por combinación con una línea de tiempo en escala común (un marcador por materia con su color y sigla, días entre marcadores) y a la izquierda el resumen ("mín. 5 días · termina 18/12"). Se muestran las 50 mejores y "ver más".
- **Elegir** crea los eventos `final` (título "Final", materia, fecha, hora o todo el día) con el servicio del Calendario. Queda marcada arriba con **Deshacer**, que borra esos eventos. Elegir otra reemplaza la anterior. No toca finales cargados a mano.
- Compu: fechas y filtros a la izquierda, combinaciones a la derecha. Celu: apilado.

Las combinaciones se calculan en el navegador con una función pura (con tests): producto de fechas con poda por filtros.

## Bloque 3: subtareas

- Columna `subtasks` (JSON) en `todo_items`: `[{ id, title, done }]`, hasta 50, título de hasta 120 caracteres. Se guardan con la tarea (`PATCH /api/todo/:id`).
- Regla en el server: si la tarea tiene subtareas, queda completa cuando están todas tildadas y vuelve a pendiente si destildás una. Tildar la principal a mano la completa sin tocar las subtareas.
- **Listas:** la fila muestra el progreso (`2/4`). Tocarla abre la tarea (la misma pantalla o panel de hoy) con las subtareas arriba, que se tildan al toque sin "Guardar"; abajo, los campos de siempre y la edición de subtareas (agregar, renombrar, borrar).
- **Widget:** tarea principal con `2/4`.
- **Importación v3:** campo opcional `subtareas` (lista de textos) en los ítems `tarea`; se ignora en los demás tipos. Se siguen aceptando v1 y v2.
- **Límite:** sin conexión se puede tildar la tarea principal, no las subtareas. Si lo querés offline, lo agrego (extiende la cola).

## Bloque 4: recordatorios en el celu

**Qué se puede en Android (S25 Ultra, APK propio):**

| Opción | Cómo suena | Viable |
|---|---|---|
| A. Notificación con sonido de alarma | Una vez, con el volumen de **alarma**: suena aunque el celu esté en silencio o vibración | Sí, confiable |
| B. Insistente | Igual que A pero se repite en loop hasta que bajás la barra o la descartás | Sí; es un flag de Android, hay que confirmar en tu celu que One UI lo respeta |
| C. Pantalla completa tipo Reloj | Suena y ocupa la pantalla hasta apagarla | Posible, pero es bastante más código nativo, pide un permiso manual en Android 14+ y es lo más frágil en One UI. No lo recomiendo |

En los tres casos: hora exacta con `AlarmManager` (funciona sin conexión, con la app cerrada y después de reiniciar el celu). Permisos: notificaciones (se pide la primera vez) y alarmas exactas (automático en un APK propio). Hay que tener la app sin restricción de batería, igual que para los widgets.

**Diseño**
- Campo `reminder_min` (minutos antes; vacío = sin recordatorio) en tareas y en eventos. Cada módulo guarda el suyo; el selector es un componente compartido del núcleo: Sin recordatorio, A la hora, 15 min, 1 h, 1 día, Personalizado (número + min/horas/días).
- Sin hora (tarea con fecha sola o evento de todo el día), la base es las 09:00. Sin fecha no hay recordatorio.
- El celu calcula y programa las alarmas en nativo (Kotlin) a partir de la copia que ya baja el sync del widget, ampliada a 30 días de eventos. No uso `@capacitor/local-notifications`: solo programa con la app abierta y no deja elegir sonido de alarma ni insistente.
- En cada sync se reprograma todo: el id de la alarma sale de la tarea o del evento, así que no se duplican; lo que se borró o se completó se cancela. Tildar desde el widget o sin conexión en la app cancela en el momento.
- Un recordatorio creado en la compu llega al celu en el próximo sync (cada 30 min con el widget puesto, o al abrir la app).
- Tocar la notificación abre la tarea o el día.

## Preguntas

1. **Sonido:** ¿A, B, o elegir en cada recordatorio entre A y B? Recomiendo elegir en cada uno (un tilde "Insistente").
2. **"Si se repite":** ¿qué querés que repita?
   - (a) Solo lo que ya se repite: en un evento semanal suena en cada ocurrencia; las tareas suenan una vez. Recomendado, sale casi gratis.
   - (b) Insistir: una tarea vuelve a sonar cada día a la misma hora hasta que la tildes.
   - (c) Tareas repetitivas (diaria/semanal) como Samsung Reminder: es una funcionalidad nueva más grande; la dejaría para otro pedido.

## Tests y docs

- Tests: `parentOf`, combinaciones y parser de finales, API de finales (elegir/deshacer), reglas de subtareas, parser v3, cálculo de recordatorios en Kotlin.
- Docs: `docs/formato-finales.md` (nuevo), `docs/formato-importacion.md` (v3), `docs/android.md` (recordatorios, permisos, sin Agenda), `README.md` y "Estado actual" de `CLAUDE.md`.
