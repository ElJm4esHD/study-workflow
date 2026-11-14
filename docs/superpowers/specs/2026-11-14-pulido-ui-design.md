# Pulido UX/UI — Etapa 1: auditoría y sistema de diseño

Pedido: `docs/pedidos/2026-11-14-pulido-ui.md`. Mockup interactivo: `2026-11-14-pulido-ui-mockup.html` (abrirlo en el navegador; arriba se elige Celu 412 px / Compu 1440 px).

## 1. Auditoría (capturas a 412 y 1440 px, datos de ejemplo)

Priorizada, de mayor a menor impacto.

1. **Barra de abajo con 6 ítems.** Etiquetas de 11 px apretadas; Importar y Ajustes (uso esporádico) ocupan lugar de primer nivel; Finales es de temporada.
2. **Controles "por defecto del navegador".** Fecha `dd/mm/yyyy` y hora `--:--` con el ícono nativo, `textarea` con el tirador de resize, `‹ ›` como texto en vez de íconos, toggles de Finales sin etiqueta.
3. **Jerarquía tipográfica plana.** Títulos de tarjeta (15 px) iguales al cuerpo; casi todo el texto secundario es el mismo gris de 12.5 px; no hay un encabezado de página con acciones.
4. **Calendario Mes ruidoso.** Las clases semanales llenan todos los días con chips `ALG 1` / `FIS 1` iguales; en el celu la leyenda de materias se corta a la derecha; "Hoy ‹ ›" son bloques pesados.
5. **Inconsistencias de componentes.** Mismo rol con tres formas: pills redondas (vistas del To-do, Orden en Finales), segmentado (Mes/Semana) y botones; la barra de color de materia solo aparece en el To-do; botones de Ajustes (Editar/Archivar de 48 px por fila) dominan la pantalla y se parten con nombres largos.
6. **Compu como "web estirada".** To-do: el formulario "Nueva tarea" ocupa siempre un tercio aunque no se use; Inicio deja media pantalla vacía; la leyenda de materias del menú repite información. Sin hover ni atajos.
7. **Tres formas de agregar una tarea** en el To-do del celu (campo + botón `+` + FAB). Las vistas (pills) se salen por la derecha ("Compl…") sin indicación.
8. **Finales muy largo en el celu.** Filtros en medio entre fechas y resultados; combinaciones con texto `← 4 días →` difícil de leer.
9. **Sin movimiento ni estados.** Pantallas que cambian de golpe, tildar solo cambia el color, sin skeletons (texto "Cargando…"), estados vacíos de una línea.
10. **A verificar en la etapa 3:** en To-do › Hoy dos filas se ven atenuadas sin motivo visible.

## 2. Sistema de diseño

Se refina el Hito C (oscuro, tarjetas, pastel + tono fuerte, compacto, 44–48 px). Todo vive como tokens en `core/web/styles.css`.

### Color

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0e1117` | fondo |
| `--surface` / `-2` / `-3` | `#161b24` / `#1d2430` / `#252d3b` | tarjeta / control y hover / elevado |
| `--line` / `--line-strong` | `rgb(255 255 255 / .07)` / `.12` | divisores / bordes de controles |
| `--text` / `--muted` / `--faint` | `#e8ebf2` / `#a3acbe` / `#8790a4` | AA sobre `--surface` (faint 5.4:1; no usar sobre `--surface-3`) |
| `--accent` / `--on-accent` / `--accent-soft` | `#b7c4ff` / `#141a33` / `rgb(183 196 255 / .14)` | acción principal, foco, selección |
| `--danger` / `--warn` / `--ok` | `#ffa3a3` / `#ffd38a` / `#93dcbf` | vencido, entrega, completado |

Materias sin cambios (`core/shared/palette.ts`): pastel para texto/tinte, fuerte para fondos sólidos de exámenes.

### Espaciado, radios, elevación

- Escala 4/8: `--s1 4` · `--s2 8` · `--s3 12` · `--s4 16` · `--s5 20` · `--s6 24` · `--s8 32` · `--s10 40`. Gutter del celu 16, de la compu 32.
- Radios: chip 6 · control 10 · tarjeta 14 · hoja 20 · pill 999.
- Elevación (en oscuro sube la superficie y se suma sombra): `--e1` tarjeta (borde interno sutil), `--e2` hoja/popover (`0 8px 24px rgb(0 0 0/.45)`), `--e3` diálogo/arrastre (`0 24px 64px rgb(0 0 0/.55)`).

### Tipografía

Fuente del sistema (se mantiene: sin descargas, funciona offline). Números tabulares.

| Rol | Tamaño / peso | |
|---|---|---|
| Display | 40 / 700, -0.03em | cuenta regresiva del examen |
| Título de página | 24 / 700, -0.02em | |
| Título de tarjeta/sección | 16 / 650 | |
| Cuerpo | 15 / 400 | filas, inputs |
| Secundario | 13 / 500 | meta, labels |
| Micro | 11.5 / 600, +0.04em, mayúsculas | encabezados de grupo, días |

### Íconos

**Lucide** (`lucide-react`, ISC). Justificación: un solo trazo (2 px, puntas redondeadas, grilla 24) igual al que ya usan nuestros 8 SVG, ~1500 íconos, se importan de a uno (solo viaja lo usado). Hacen falta ~30 (navegación, acciones, categorías, tipos de evento, estados). En el widget se copian los mismos paths como vector drawables.

Mapa: Inicio `house` · To-do `list-checks` · Calendario `calendar` · Finales `flag` · Importar `download` · Planes `list` · Ajustes `settings` · Más `ellipsis` · tarea `check` · entrega `upload` · estudio `book-open` · evento `calendar-clock` · parcial `pen-line` · recuperatorio `rotate-ccw` · final `graduation-cap` · recordatorio `bell` · hora `clock` · subtareas `list-tree` · borrar `trash-2` · sin conexión `wifi-off` · vacío `inbox`.

### Movimiento

Sin librería: **View Transitions API** (cambio de pantalla, alta/baja/reorden de filas, cambio de mes y de vista) + **CSS** (micro-interacciones, hoja con curva de resorte vía `linear()`). Motion (framer) no se justifica: la WebView del S25 y el Chrome de la compu soportan todo esto.

| Token | Valor | Uso |
|---|---|---|
| `--d-micro` | 120 ms | hover, press, toggles |
| `--d-small` | 200 ms | check, chips, tabs |
| `--d-screen` | 260 ms | pantallas, mes |
| `--d-sheet` | 420 ms | hojas y paneles |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | entradas |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` | salidas (más cortas) |
| `--spring` | `linear(…)` (amortiguado 0.72, sobrepaso ~4 %) | hojas, check, indicadores |

- Pantallas: fundido + subida de 8 px. Mes: deslizamiento según la dirección. Vista Mes/Semana: fundido cruzado.
- Filas: tildar dibuja el tilde y la fila se va (las de abajo suben); deslizar a la derecha completa, a la izquierda borra, ambos con "Deshacer".
- Hoja del día: entra con resorte, se cierra arrastrando o con el fondo.
- Carga: skeletons con brillo, y aparición escalonada (máx. 6 ítems, 30 ms entre sí).
- `prefers-reduced-motion`: todo pasa a 0 ms (las View Transitions también).
- Solo `transform` y `opacity` animados (60 fps).

### Componentes base (únicos en toda la app)

`Button` (primary / secondary / ghost / danger; 44 px, 36 px solo con puntero fino) · `IconButton` · `Field` (label + ayuda + error) con `Input`, `TextArea`, `DateField`/`TimeField` propios (texto `dd/mm/aaaa`, sin ícono nativo) · `Segmented` (con indicador que se desliza; reemplaza pills de vistas y orden) · `Chip` (materia tinte / examen sólido / filtro) · `Toggle` · `Checkbox` · `Card` + `CardHeader` · `ListRow` y `TaskRow` (la misma en To-do, Inicio, Calendario) · `Sheet` (hoja abajo en el celu, panel a la derecha en la compu) · `Dialog` (confirmar) · `Toast` (con Deshacer) · `EmptyState` (ícono + texto + acción) · `Skeleton` · `PageHeader` (título, subtítulo, acciones) · `Kbd`.

Foco visible: anillo de 2 px `--accent` con halo `--accent-soft` (nunca el contorno por defecto).

### Navegación

- **Celu:** 4 ítems — Inicio, To-do, Calendario, **Más** (hoja con Finales, Importar, Planes y Ajustes). Indicador activo que se desliza. Un solo `+` flotante contextual (To-do → tarea, Calendario → evento del día elegido).
- **Compu:** barra lateral de 232 px agrupada (Principal / Facultad / Ajustes abajo), sin la leyenda de materias. Encabezado de página con acciones. Paneles: To-do lista + detalle; Calendario grilla + panel del día; Inicio en grilla de 12 columnas.
- **Atajos (compu):** `N` nueva tarea · `1` `2` `3` Inicio/To-do/Calendario · `←` `→` mes/semana · `T` hoy · `Esc` cerrar. No hay búsqueda, así que `/` no se agrega.

### Nativo (etapa 4)

Hápticos con `@capacitor/haptics` (oficial, usa los efectos del sistema; `navigator.vibrate` se siente tosco) en tildar, completar, borrar y soltar al reordenar. Gestos de deslizar en filas. Widget: mismos tokens de color, espaciado e íconos.
