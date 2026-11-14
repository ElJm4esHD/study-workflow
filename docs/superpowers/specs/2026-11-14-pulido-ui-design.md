# Pulido UX/UI — Etapa 1: auditoría y sistema de diseño

Pedido: `docs/pedidos/2026-11-14-pulido-ui.md`. Mockup interactivo: `2026-11-14-pulido-ui-mockup.html` (también publicado como página privada). En una pantalla ancha, arriba se elige Celu 412 px o Compu; en el celu ocupa toda la pantalla.

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

**Motion (`motion/react`)**. Justificación: resortes interrumpibles (si tocás a mitad de una animación, sigue desde donde está y con su velocidad), gestos que siguen el dedo y se sueltan con velocidad (`drag` con `dragConstraints`/`onDragEnd` en la hoja del día y en las filas), animaciones de layout cuando la lista se reacomoda (`layout` + `AnimatePresence` para las salidas) y escalonados. Con CSS + View Transitions habría que escribir a mano la física, la velocidad al soltar y las salidas. Se carga con `LazyMotion` + `domMax` (incluye drag y layout, ~30 kB gz).

El mockup usa el `animate()` de Motion sin React (mismos resortes, FLIP a mano para el layout); en la app se usan los componentes `motion.*`.

Resortes (con `visualDuration` en segundos y `bounce`; se multiplican por la velocidad elegida):

| Nombre | `visualDuration` | `bounce` | Uso |
|---|---|---|---|
| `snappy` | 0.22 | 0.15 | indicadores, filas al soltar, botones |
| `gentle` | 0.32 | 0 | reacomodo de listas, pantallas, mes |
| `sheet` | 0.38 | 0.12 | hojas y paneles, toasts |
| `pop` | 0.30 | 0.5 | tilde del checkbox |

Transiciones CSS que quedan (hover, press, color): `--d-micro` 120 ms, `--d-small` 200 ms, `--d-screen` 260 ms, todas `calc(… * var(--k))`.

- Pantallas: sale con fundido corto, entra con subida de 10 px y escalonado de las tarjetas.
- Listas: tildar dibuja el tilde con rebote; la fila se va y las de abajo suben con resorte; la tarjeta achica su alto.
- Deslizar fila: sigue el dedo; pasado el 40 % (o con un movimiento rápido) completa (derecha) o borra (izquierda), si no vuelve con la velocidad que traía. Siempre con "Deshacer".
- Hoja del día: entra con resorte; se arrastra desde la manija o desde el contenido si está arriba de todo; se cierra al pasar el 30 % o con un movimiento rápido hacia abajo.
- Tirar para refrescar (To-do y Calendario, solo celu): el indicador baja con resistencia, gira según la distancia, se arma a los 64 px (vibración corta) y al soltar vibra y vuelve a pedir los datos al servidor.
- Mes/semana: deslizamiento según la dirección. Vista Mes/Semana: fundido cruzado.
- Carga: skeletons con brillo.
- Solo `transform`, `opacity` y alto de tarjetas (este último al reacomodar). Las animaciones nunca bloquean los toques.
- **Fallback:** si Motion no carga o la velocidad es "Sin animaciones", todo se aplica al instante con el mismo código (`MotionConfig reducedMotion="always"` y `--k: 0`).

### Ajustes nuevos (sección "Movimiento y vibración" + "Texto")

Se guardan **por dispositivo** en `localStorage` (no en los ajustes del servidor, que son compartidos), leídos al arrancar. Se agregan a `AjustesPage`.

| Ajuste | Opciones | Por defecto | Efecto |
|---|---|---|---|
| Velocidad de animaciones | Lenta (×1.6), Normal (×1), Rápida (×0.6), Sin animaciones (×0) | Normal; "Sin animaciones" si el sistema tiene "reducir movimiento" | multiplica `visualDuration`/duraciones y `--k` |
| Vibración (solo APK; en la web no se muestra) | Apagada, Suave, Media, Fuerte | Media | `Haptics.impact` Light / Medium / Heavy; Apagada no llama |
| Tamaño de letra | Chica (×0.92), Normal, Grande (×1.12) | Normal | escala los tokens de tipografía (`--fs`); las zonas táctiles no cambian |

Los tokens de tipografía pasan a `calc(Npx * var(--fs))` (`--t-micro`, `--t-meta`, `--t-sec`, `--t-body`, `--t-card`, `--t-h2`, `--t-page`, `--t-display`).

### Componentes base (únicos en toda la app)

`Button` (primary / secondary / ghost / danger; 44 px, 36 px solo con puntero fino) · `IconButton` · `Field` (label + ayuda + error) con `Input`, `TextArea`, `DateField`/`TimeField` propios (texto `dd/mm/aaaa`, sin ícono nativo) · `Segmented` (con indicador que se desliza; reemplaza pills de vistas y orden) · `Chip` (materia tinte / examen sólido / filtro) · `Toggle` · `Checkbox` · `Card` + `CardHeader` · `ListRow` y `TaskRow` (la misma en To-do, Inicio, Calendario) · `Sheet` (hoja abajo en el celu, panel a la derecha en la compu) · `Dialog` (confirmar) · `Toast` (con Deshacer) · `EmptyState` (ícono + texto + acción) · `Skeleton` · `PageHeader` (título, subtítulo, acciones) · `Kbd`.

Foco visible: anillo de 2 px `--accent` con halo `--accent-soft` (nunca el contorno por defecto).

### Navegación

- **Celu:** 4 ítems — Inicio, To-do, Calendario, **Más** (hoja con Finales, Importar, Planes y Ajustes). Indicador activo que se desliza. Un solo `+` flotante contextual (To-do → tarea, Calendario → evento del día elegido).
- **Compu:** barra lateral de 232 px agrupada (Principal / Facultad / Ajustes abajo), sin la leyenda de materias. Encabezado de página con acciones. Paneles: To-do lista + detalle; Calendario grilla + panel del día; Inicio en grilla de 12 columnas.
- **Atajos (compu):** `N` nueva tarea · `1` `2` `3` Inicio/To-do/Calendario · `←` `→` mes/semana · `T` hoy · `Esc` cerrar. No hay búsqueda, así que `/` no se agrega.

### Nativo (etapa 4)

Hápticos con `@capacitor/haptics` (oficial, usa los efectos del sistema; `navigator.vibrate` se siente tosco) en tildar, completar, borrar, soltar al reordenar y soltar al refrescar, con la intensidad del ajuste. Gestos de deslizar en filas. Widget: mismos tokens de color, espaciado e íconos.

### Dependencias nuevas

- `lucide-react`: set de íconos consistente, se importan de a uno.
- `motion`: resortes interrumpibles, drag con velocidad y animaciones de layout (ver Movimiento).
- `@capacitor/haptics` (etapa 4): vibración nativa con intensidad.
