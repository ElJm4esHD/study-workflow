# Hito C: rediseño visual, dashboard y modelo de datos

Fecha: 05/11/2026. Va entre el Hito B (calendario, ya deployado y probado) y la Fase 2 (APK).
Mockup aprobado: `docs/superpowers/specs/2026-11-05-hito-c-mockups.html` (abrir en el navegador). Es la referencia visual: colores, tamaños, layout y textos salen de ahí.

Marcas: **[usuario]** = lo decidió Federico. **[mía]** = decisión de diseño mía, revisable.

## 1. Por qué

La app funciona pero el diseño no sirve. El calendario lista todas las tareas en cada día y se estira; en la compu ocupa un tercio de la pantalla. No hay una pantalla de inicio que responda "¿qué tengo hoy y cuánto falta para el próximo examen?". Y faltan datos para planificar (cuánto dura cada tarea, qué tipo de tarea es, una sigla corta por materia). **[usuario]**

**Éxito:** abrir la app en el celu y, en una pantalla, ver el próximo examen con la cuenta regresiva, lo de hoy tildable con el tiempo total y la semana por materia. El calendario entra completo en el celu y usa todo el ancho en la compu.

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- Rediseño visual completo con la dirección de la sección 3.
- Dashboard nuevo como pantalla de inicio.
- Calendario mes con un chip por materia por día y exámenes en color sólido. Detalle del día al tocar.
- To-do con categoría y duración estimada, más compacto.
- Materias con sigla. To-do con `categoria` y `duracion`. Formato de importación v2.

**No-objetivos (en este hito)**
- Tema claro (los colores salen de variables para agregarlo después). **[usuario]**
- Duración en eventos del calendario. Los exámenes siguen siendo eventos (`parcial`, `recuperatorio`, `final`). **[usuario]**
- Rediseñar el layout de la vista Semana, la vista Agenda, Ajustes, Importar ni Planes: solo se les aplica el sistema visual nuevo (tokens, tarjetas, controles).
- Widgets y APK (Fases 2 y 3).

**Anti-objetivos**
- Copiar el estilo visual de cualquier app de referencia. Solo se toman las ideas de la sección 5. **[usuario]**
- Fuentes externas, rebotes o animaciones largas. **[usuario]**
- Romper planes v1 ya generados por la skill: la v1 se sigue aceptando. **[usuario]**
- Perder zonas táctiles: 44–48 px mínimo en el celu, aunque la densidad sea compacta. **[usuario]**

## 3. Dirección visual **[usuario]** (valores concretos **[mía]**, aprobados en el mockup)

- **Estilo:** oscuro con tarjetas. Contenido en tarjetas (`--surface`) separadas del fondo (`--bg`).
- **Tema:** oscuro siempre (`color-scheme: dark`). Se reemplaza el modo claro/oscuro según sistema que había. Todos los colores en variables CSS de `:root` en `core/web/styles.css`; un tema claro futuro solo redefine ese bloque.
- **Tokens base** (del mockup):
  `--bg #10131a`, `--surface #191e28`, `--surface-2 #222937`, `--line #2b3342`, `--text #e6e9f0`, `--muted #98a1b3`, `--faint #7b859b`, `--accent #b7c4ff`, `--on-accent #141a33`. Vencidas en `#ffadad`, "Entrega" en `#ffd38a` (también como variables).
- **Esquinas:** tarjetas 12 px, controles 10 px, chips 4–6 px.
- **Densidad:** compacta. Filas de tarea de 48 px, checkbox con zona táctil de 44 × 44. Las celdas del mes son el blanco táctil de cada día.
- **Tipografía:** `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`. Números con `font-variant-numeric: tabular-nums`. Escala del mockup (22 / 18 / 15 / 14.5 / 13 / 12.5 / 11.5 / 10.5 px).
- **Animaciones:** 160 ms, `cubic-bezier(.2,.7,.3,1)`, solo como respuesta a una acción: tildar (check que escala), abrir el detalle del día (sube 24 px y aparece), cambiar de mes (fundido). Con `prefers-reduced-motion` se desactivan.
- **Colores de materias:** cada color de la paleta tiene dos tonos: **pastel** (chips, puntos, textos de materia, celdas teñidas) y **fuerte** (fondo sólido de exámenes, con texto blanco). **[usuario]** La paleta pasa a 12 pares (mismos nombres que la actual). Requisitos: el pastel sobre `--surface` y el texto blanco sobre el fuerte cumplen contraste ≥ 4.5:1; un test lo verifica. Los 5 pares del mockup son la referencia del tono.
- **Motivo propio: "regla de días"** **[mía, aprobado]**. Una fila de casilleros, uno por día. Cada casillero se tiñe según los minutos planeados de una materia ese día: 0 → vacío, 1–45 → nivel 1, 46–90 → nivel 2, > 90 → nivel 3 (mezcla del pastel al 28 / 55 / 85 % sobre `--surface-2`). El día de examen va en el tono fuerte. Hoy lleva una rayita de `--accent` abajo. Se usa en "Próximo examen" y en "Próximos 7 días".

## 4. Modelo de datos

### Materia: sigla **[usuario]**
- Columna nueva `sigla` (texto, obligatorio, 1 a 5 caracteres, letras y dígitos, se guarda en mayúsculas). No es única. **[mía]**
- Editable en Ajustes → Materias. Al crear, si se deja vacía, el server la genera.
- **Generación automática** **[mía]**: se sacan las tildes y se pasa a mayúsculas. Se descartan "de", "del", "la", "el", "y", "en" y "a". Un número romano final (I a V) o un dígito final pasa a dígito. Con dos o más palabras, va la inicial de cada una más ese dígito: "Análisis Matemático II" → `AM2`, "Programación Imperativa" → `PI`, "Matemática Discreta" → `MD`. Con una sola palabra, van sus 3 primeras letras: "Física" → `FIS`, "Álgebra" → `ALG`. Se corta a 5 caracteres. Tiene test.
- **Migración:** las materias existentes reciben la sigla generada. Las migraciones son SQL puro (`core/server/migrate.ts`), así que se hace en dos partes. **[mía]**
  - La migración SQL agrega la columna con default `''` y pasa los 12 colores viejos a los pasteles con un `CASE`.
  - Al arrancar, después de las migraciones, el núcleo completa con la sigla generada las que estén vacías. Es idempotente.
- **Color:** `materias.color` sigue guardando un hex de la paleta, ahora el pastel. La migración pasa cada color viejo al pastel del mismo nombre (Rojo → Rojo pastel, etc.). Si un color no está en la paleta, va al par más cercano por distancia RGB. El tono fuerte no se guarda: se obtiene de la paleta a partir del pastel (`strongOf(hex)` en `core/shared/palette.ts`). **[mía]**
- API: `sigla` en `Materia`, en `POST` y en `PATCH /api/materias`.

### To-do: duración y categoría **[usuario]**
- `duration_min`: entero entre 1 y 1440, opcional (`null` = sin estimar). En la API, `durationMin`.
- `category`: texto, obligatorio, por defecto `'tarea'`. Valores actuales: `tarea`, `entrega`, `estudio`. En la API, `category`.
- **Agregar una categoría** = agregar un elemento a la lista `TODO_CATEGORIES` (id + etiqueta) en `modules/todo/shared.ts`. El backend valida contra esa lista. No hay `CHECK` en SQL, así que no hace falta otra migración. **[mía]**
- Agregar rápido sigue creando una tarea con categoría `tarea` y sin duración.
- Para totales y la regla de días, una tarea sin duración suma 0 minutos al total, pero marca el casillero de su día con nivel 1 como mínimo. **[mía]** El total del día dice cuántas están sin estimar si hay alguna ("2 h 30 min estimados, 1 sin estimar").

### Formato de importación v2 **[usuario]** (detalles **[mía]**)
- `version` puede ser `1` o `2`. Cualquier otro valor da el error de versión no soportada.
- Ítem: campos nuevos opcionales:
  - `duracion`: entero de minutos, entre 1 y 1440.
  - `categoria`: `"tarea"`, `"entrega"` o `"estudio"`. Por defecto, `"tarea"`.
- Solo aplican a `tipo: "tarea"`. En los demás tipos se ignoran.
- Se leen igual en planes v1 y v2: un solo camino en el parser. La skill v1 nunca los manda, así que la v1 sigue funcionando igual.
- Errores nuevos por ítem: `Duración inválida (minutos enteros entre 1 y 1440).` y `Categoría inválida: "<x>".`
- La vista previa muestra la categoría (si no es `tarea`) y la duración de cada ítem.
- Duplicados: la misma regla que antes; duración y categoría no cuentan.
- `docs/formato-importacion.md` se actualiza a v2, con una sección "Cambios de v1 a v2". Al terminar el hito se le pasa al usuario el texto exacto de los cambios para que actualice la skill `cargar-app`.

## 5. Pantallas (ver mockup)

Ideas tomadas de referencias **[usuario]**: celdas teñidas con color y sigla, exámenes sólidos, tarjeta de próximo examen con cuenta regresiva en días, leyenda de materias, dashboard que lleva a secciones con detalle y duración en cada tarea.

### Navegación
- Ítems: Inicio, To-do, Calendario, Importar, Ajustes. Es una barra inferior en el celu y una barra lateral de 208 px en la compu (≥ 768 px). **[mía]**
- La barra lateral lleva abajo la leyenda de materias (punto de color + nombre, solo las no archivadas).
- `/` pasa a ser Inicio (antes redirigía al primer módulo).
- En la compu se saca el `max-width: 680px` del contenido: cada pantalla decide su ancho. El calendario y el to-do usan todo el ancho.

### Inicio (dashboard)
- Título: la fecha de hoy en palabras ("Jueves 5 de noviembre"). No lleva "Semana N del cuatrimestre" porque no hay dato de cuatrimestre. **[mía]**
- **Tarjeta "Próximo examen"** (del módulo Calendario):
  - El primer evento `parcial`, `recuperatorio` o `final` desde hoy, dentro de los próximos 120 días. Si no hay: "Sin exámenes en los próximos 4 meses."
  - Muestra la cantidad de días en grande, con el color pastel de la materia ("7 días"; "Hoy" si es hoy, "1 día" si es mañana). Debajo, "Parcial de Física" y "jueves 12/11, 09:00".
  - Regla de días desde hoy hasta el examen, con un rótulo L M X J V S D. Solo se muestra si faltan ≤ 28 días.
  - Debajo, una línea "Después: <tipo> de <materia> en N días" si hay un segundo examen.
  - Link "Calendario" que abre el día del examen.
- **Tarjeta "Hoy"** (del módulo To-do):
  - Vencidas sin completar y las tareas de hoy, tildables. **[usuario]** Las vencidas se muestran como máximo 5, las más viejas primero; si hay más, un link "Ver N más" abre el To-do en la vista Hoy. Las de hoy se muestran todas.
  - Línea de total: "<pendiente> pendientes de <total>".
  - Link "To-do" que abre la vista Hoy.
- **Tarjeta "Próximos 7 días"** (del módulo Calendario):
  - De mañana a hoy + 7, una fila por materia que tenga tareas o exámenes en el rango.
  - Cada fila: punto y nombre, regla de 7 días, y "N · tiempo".
  - Tareas y eventos sin materia: fila "Sin materia" en gris neutro. **[mía]**
  - Tocar una fila abre el calendario en la semana. **[mía]**
- **Layout:**
  - Celu: una columna en el orden Próximo examen, Hoy, Próximos 7 días.
  - Compu: dos columnas (5 fr / 7 fr). A la izquierda, Próximo examen y Próximos 7 días; a la derecha, Hoy.

### Calendario: vista mes
- Cada día muestra la fecha y **un chip por materia** que tenga ese día tareas o eventos que no son examen: sigla y cantidad (`FIS 3`), con fondo pastel al 20 % y texto pastel.
  - Máximo 3 chips en el celu y 4 en la compu, después "+N".
  - Si todas las tareas de un chip están completas y el día ya pasó, el chip va atenuado.
  - Sin materia: chip "Otros" en gris neutro. **[mía]**
- **Día con examen:** la celda entera en el tono fuerte de esa materia, con la sigla y el tipo ("FIS / Parcial") en blanco. Los chips de otras materias de ese día van encima, en blanco translúcido. Si hay dos exámenes ese día, manda el primero por hora y el chip del segundo va en sólido. **[mía]**
- Hoy: el número con fondo `--accent`. El día seleccionado: fondo `--surface-2`.
- **Tamaño:** entra entero en el celu (6 semanas, sin scroll horizontal, celda de ~76 px de alto con 412 px de ancho). En la compu, la grilla llena el alto y el ancho disponibles, menos el panel del detalle.
- **Barra superior:** título del mes, "Hoy", ‹ ›, y el selector Mes / Semana / Agenda (debajo del título en el celu, en la misma barra en la compu). El swipe para cambiar de mes y de semana se mantiene.
- **Leyenda:** en el celu, una fila con scroll horizontal debajo de la grilla. En la compu, en la barra lateral.
- **Tocar un día:** abre el detalle de ese día. El URL pasa a `?vista=mes&fecha=…&dia=YYYY-MM-DD`, para que un link (por ejemplo, de los widgets en la Fase 3) abra un día directo. "Atrás" del navegador o de Android cierra el detalle. **[mía]**
- **Cómo se arma** **[mía]**: se sigue usando FullCalendar (dayGrid).
  - En la vista mes no se le pasan los eventos crudos: se le pasa un evento de todo el día por cada par (día, materia) con la sigla y la cantidad, y se pinta con `eventContent`.
  - Los exámenes pintan la celda con los hooks de celda de día (`dayCellClass` / `dayCellTopContent` o los que correspondan en v7).
  - El implementador lo verifica con Context7. Si FullCalendar 7 no permite pintar la celda entera o controlar la altura sin pelear, se puede hacer la vista mes como grilla propia (CSS grid de 7 × 6) y dejar FullCalendar para Semana y Agenda. Esa decisión se anota en el plan.
- **Vista Semana y vista Agenda:** se quedan como están, con el estilo nuevo: eventos con pastel tenue y borde de color, exámenes sólidos en el tono fuerte con texto blanco y to-dos con ☐/☑.

### Detalle del día
- Celu: hoja que sube desde abajo sobre el calendario (máximo 82 % del alto). Se cierra tocando afuera o con "Atrás". Compu: panel fijo de 380 px a la derecha del mes, que muestra el día seleccionado (hoy por defecto).
- Contenido, en orden:
  1. Encabezado con el día de la semana y la fecha ("Jueves 05/11"), y "Hoy" si corresponde.
  2. Total: "<tiempo> estimados, X de Y hechas", más una barra de progreso de las tareas hechas.
  3. Exámenes del día: tarjeta sólida en el tono fuerte con el tipo, la materia, el título y la hora.
  4. Otros eventos: fila con borde, punto de color, título y hora.
  5. Tareas agrupadas por materia. Cada grupo lleva un encabezado con el punto, el nombre y el subtotal de tiempo. Cada fila tiene checkbox (tilda al toque, vía la API de To-do), título, categoría (si no es `tarea`) y duración.
- Tocar una tarea abre su edición, y tocar un evento abre la suya.
- Botones "Agregar tarea" y "Agregar evento" con la fecha del día precargada. **[mía]**
- Día vacío: "Nada para este día." más los dos botones.

### To-do
- Filtros en píldoras con scroll horizontal: Hoy, Próximas, Sin fecha, Por materia y Completadas (las mismas vistas de antes).
- Agregar rápido arriba (campo + botón "+").
- Secciones (Vencidas, Hoy, etc.), cada una con su tiempo total a la derecha.
- Fila de 48 px: barra de color de la materia, checkbox, título, una línea de meta (chip de sigla, categoría si no es `tarea`, "venció dd/mm" si está vencida, fecha en Próximas) y la duración a la derecha.
- El reordenamiento con long-press sigue igual.
- **Edición:**
  - En la compu (≥ 1024 px), `/todo/:id` y `/todo/nueva` se abren en un panel de 400 px al lado de la lista. **[mía]**
  - En el celu sigue siendo una pantalla aparte.
  - Campos nuevos:
    - **Categoría:** píldoras.
    - **Duración:** píldoras de 15 min, 30 min, 45 min, 1 h y 1 h 30 min, más "Otra…", que abre un campo numérico en minutos. Tocar la píldora activa la deselecciona, y la tarea queda sin estimar.
  - Materia en píldoras con la sigla.

### Ajustes, Importar, Planes y Editar evento
- Toman los tokens y componentes nuevos (tarjetas, controles de 44–48 px, píldoras), sin cambiar su estructura.
- Materias suma el campo Sigla, prellenado con la generada al tipear el nombre (editable). El selector de color muestra los 12 pasteles.
- La vista previa de Importar muestra la duración y la categoría.

## 6. Arquitectura

- **Contrato de módulo web: campo nuevo opcional `dashboard`** **[mía]**:
  - Es una lista de `{ id, order, column: 'left' | 'right', Card: ComponentType }`.
  - El núcleo arma Inicio con las tarjetas de los módulos activos, ordenadas por `order`. En el celu va todo en una columna, por `order`; en la compu se reparte por `column`.
  - Calendario aporta "Próximo examen" (order 10, left) y "Próximos 7 días" (order 30, left). To-do aporta "Hoy" (order 20, right).
  - Si un módulo está desactivado, su tarjeta no aparece. Si no hay ninguna, Inicio muestra "Activá módulos en Ajustes".
  - Se documenta en `docs/modulos.md`.
- Las tarjetas del Calendario leen `GET /api/calendar/agenda` (que ya incluye los to-dos con fecha si To-do está activo). La tarjeta "Hoy" lee la API de To-do, porque las vencidas quedan fuera de cualquier rango de agenda.
- El detalle del día tilda tareas llamando a `PATCH /api/todo/:id` por `core/web/api.ts`. Es la API de otro módulo, no sus tablas, así que está permitido por el contrato.
- **Lógica pura con tests** (en archivos `.ts` sin React):
  - `levelOf(minutes, hasUndated)` de la regla.
  - Agrupado de un día por materia (chips y detalle).
  - Selección del próximo examen y del siguiente.
  - Resumen de 7 días por materia.
  - Formato de duración (`45 min`, `1 h`, `1 h 30 min`).
  - Generación de sigla.
  - Contraste de la paleta.
- Dependencias nuevas: ninguna.

## 7. Calidad

- **TDD** en backend (migraciones, validación de `sigla`, `durationMin`, `category`, parser v2) y en la lógica pura de la sección 6. UI: lo justo.
- **Accesibilidad:**
  - Zonas táctiles ≥ 44 px (48 en filas y botones principales).
  - Contraste AA, con un test sobre los tokens y la paleta.
  - Labels en checkbox ("Completar: <título>") y en celdas ("jueves 12/11: parcial de Física, 2 tareas").
  - Foco visible.
- **Errores:** siguen visibles en la UI. Si falla la carga del dashboard, cada tarjeta muestra su error con "Reintentar".
- **Docs:** `docs/formato-importacion.md` (v2), `docs/modulos.md` (`dashboard`) y README (capturas no; solo lo que cambió de uso).

## 8. Queda para el que construye

- Los 12 pares pastel / fuerte exactos, dentro de los requisitos de contraste y del tono del mockup.
- Si la vista mes queda con FullCalendar o como grilla propia (sección 5), con la razón anotada.
- Cómo partir el trabajo en tareas.
- Detalles de CSS que el mockup no fija, siguiendo sus proporciones.

## 9. Al terminar el hito

Frenar. Pasarle al usuario:
- La checklist de prueba (celu y compu).
- El comando de deploy.
- El texto exacto de los cambios del formato v2 para la skill.

No arrancar la Fase 2 sin su OK.
