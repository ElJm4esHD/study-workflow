# Pulido UX/UI — estado y traspaso

Pedido: `docs/pedidos/2026-11-14-pulido-ui.md`. Diseño: `docs/superpowers/specs/2026-11-14-pulido-ui-design.md`. Mockup (referencia visual y de animaciones): `docs/superpowers/specs/2026-11-14-pulido-ui-mockup.html`, publicado también en https://claude.ai/artifact/SuVpQLbbVXwH5sW3psbMEv (privado).

## Etapas

| Etapa | Estado | Commit |
|---|---|---|
| 1. Auditoría + sistema de diseño + mockup | Hecha y aprobada (decisiones 1, 2, 4, 5 tal cual; la 3 cambió a Motion) | `63f1118`, `22a7762`, `45c2424` |
| 2. Base (tokens, íconos, Motion, navegación, ajustes, componentes) | Hecha, commiteada. Falta que el usuario la pruebe | `a2060ef` |
| 3. Pantallas, de a grupos con un commit por grupo | Hecha. Falta que el usuario la pruebe (y probar gestos en el celu real) | `90934d6` (To-do e Inicio), `b37cf3b` (Calendario), `6392488` (Finales, Importar, Planes, Ajustes) |
| 3b. Correcciones tras probar (portal para lo fijo, deslizar entre secciones, sidebar sin grupos, animaciones en la compu, subtareas desde la lista) | Hecha, probada en el celu | ver `git log` |
| 4. Widget y detalles nativos (hápticos con `@capacitor/haptics`, gestos, widget Glance) | Pendiente | — |

Grupos de la etapa 3, en orden: (a) To-do e Inicio; (b) Calendario; (c) Finales, Importar, Planes y Ajustes. El usuario pidió "dale con la etapa 3" y dejó el celu enchufado con depuración USB.

## Decisiones del usuario

- Navegación del celu: Inicio, To-do, Calendario y **Más** (hoja con Finales, Importar, Ajustes). Compu: barra lateral agrupada, atajos `1…n` y `N`.
- Íconos: `lucide-react`, siempre vía `core/web/icons.tsx` (los módulos no importan de lucide directo).
- Animaciones: **Motion** (`motion/react`), no solo CSS. Resortes interrumpibles, gestos con velocidad, layout, fallback sin animación.
- Ajustes por dispositivo (localStorage `sw.prefs`, no van al servidor): velocidad de animaciones (lenta/normal/rápida/sin animaciones; arranca en "sin" si el sistema reduce movimiento), vibración (apagada/suave/media/fuerte, solo APK, default media). **Cambio 3b:** la velocidad arranca siempre en "normal" (Windows del usuario tiene los efectos apagados y eso apagaba todo), tamaño de letra (chica/normal/grande).
- Extra pendiente: tirar para refrescar en To-do y Calendario (celu), con vibración al soltar. Deslizar fila: derecha completa, izquierda borra, con "Deshacer". Hoja del día arrastrable. Ver mockup para el comportamiento exacto (umbral 40 %, fling > 700 px/s).
- Reglas de trabajo (CLAUDE.md): sin subagentes, una sola revisión al final de cada etapa, Context7 una vez por librería (ya se consultó Motion), respuestas cortas, frenar al final de cada etapa con checklist, deploy y APK.

## Lo que hay hecho en el código (etapa 2)

- `core/web/styles.css`: tokens nuevos (`--surface-3`, `--line-strong`, `--accent-soft`, `--e1/2/3`, `--s1…s8`, `--t-*` de tipografía con `--fs`, `--d-*` con `--k`). Se conservaron los nombres viejos (`--late`, `--entrega`, `--r-card`, `--t`…) y las clases que usan los módulos (`.btn`, `.card`, `.chip`, `.task-row`, `.chk`, `.pill`, `.seg`, `.list`, `.toast`…).
- `core/web/prefs.ts` (ajustes + `usePrefs`/`setPref`, pone `--k`, `--fs` y `html[data-motion]`), `motion.tsx` (`MotionRoot` con `LazyMotion`+`domMax`, `useMotion()` con `spring('snappy'|'gentle'|'sheet'|'pop')` y `fade()`), `haptics.ts` (`vibrate()`; hoy usa `navigator.vibrate` solo en nativo; etapa 4 pasa a Capacitor), `ui.tsx` (`PageHeader`, `EmptyState`, `Skeleton`, `PageSkeleton`, `Segmented`, `Sheet`), `icons.tsx` (set Lucide con los nombres de siempre más nuevos: `CloseIcon`, `CheckIcon`, `TrashIcon`, `InboxIcon`, `RefreshIcon`, `ChevronRightIcon`, `ChevronLeftIcon`, `MoreIcon`, `ListIcon`, `BookIcon`, `GaugeIcon`, `VibrateIcon`, `TypeIcon`).
- `Shell.tsx` (barra de abajo 4 ítems + hoja Más, sidebar agrupada, atajos, entrada animada de pantalla por primer segmento de la ruta), `CoreContext.tsx` (toast con Motion, skeleton de carga), `App.tsx` (`MotionRoot`), `AjustesPage.tsx` (sección `Dispositivo`), `registry.ts` (`nav.more`; marcado en finales e import).
- Dependencias nuevas: `lucide-react`, `motion` (14.x). Falta `@capacitor/haptics` (etapa 4).

## Etapa 3: qué quedó

- Core nuevo en `ui.tsx`: `TaskRow` (fila única con deslizar completar/borrar vía `drag="x"` de Motion, entrada/salida/reacomodo con `m.li layout`, compatible con dnd-kit pasando `dndRef/dndProps/dndStyle`; `noLayout` justo después de soltar un reorden) y `PullToRefresh` (solo `pointer: coarse`, llama `reloadAll()`; no se activa si se mantuvo apretado > 220 ms, para no pisar el reorden). `notify(msg, undo?)` muestra "Deshacer".
- To-do: borrar deslizando oculta ya y manda el DELETE a los 6 s (o al salir de la pantalla); "Deshacer" lo cancela. Completar deslizando no usa el "linger" de 1,5 s, usa el toast.
- Arreglado: filas atenuadas en To-do › Hoy (dnd-kit ponía `aria-disabled` en las tareas con hora).
- Calendario: hoja del día = `Sheet` del core; el mes entra deslizándose según la dirección; celu con puntos, compu con chips.
- Global: checkbox/radio propios (`appearance: none`), `dialog` con un solo estilo, `.btn` con ícono, `input.bare`.
- Quedan nativos: los selectores de fecha/hora (solo se tiñó el ícono) y los `select`. Un date picker propio sería trabajo aparte.

## Para la etapa 3 (ideas que se usaron)

- Cambiar en cada pantalla: título → `PageHeader`; pills de vista → `Segmented` (o mantener `.pill` para filtros múltiples como materias); estados vacíos → `EmptyState`; "Cargando…" → `Skeleton`; checkbox y filas con el mismo diseño; hoja del día (calendario celu) → `Sheet`; íconos en tipos de evento y categorías (tarea `Check`, entrega `Upload`, estudio `BookOpen`; evento `CalendarClock`, parcial `PenLine`, recuperatorio `RotateCcw`, final `GraduationCap`; ver tabla en el diseño); un solo botón de agregar tarea en el celu (hoy hay campo rápido + `+` + FAB `.todo-fab`).
- To-do usa `@dnd-kit` para reordenar (`useSortable`, activación con delay 250 ms) y el deslizar-fila del mockup puede chocar: probar en celu real. Si choca, deslizar con `drag="x"` de Motion en la fila y dejar el reorden por mantener apretado.
- Animar lista (tildar/borrar/reordenar) con `AnimatePresence` + `layout` de Motion en `m.li`. Ojo: hoy los ítems recién tildados se quedan 1,5 s en su vista (`linger`) para poder deshacer.
- Los módulos todavía usan tamaños de fuente fijos en px en su CSS: pasar a `var(--t-*)` para que "Tamaño de letra" funcione.
- Inicio: `core/web/InicioPage.tsx` arma tarjetas de los módulos (`dashboard` en `WebModule`); las de calendario (Próximo examen, Próximos 7 días) están en `modules/calendar/web/cards.tsx`, y la de Hoy en `modules/todo/web/HoyCard.tsx`. Referencia: mockup (número grande del examen, barra de progreso, regla de días).
- Radios nativos en `CalendarSettings.tsx` (Ajustes › Calendario): usar los `.radios` de `styles.css`.
- Calendario: mes con puntos de color (celu) / ítems cortos con hora (compu), exámenes con el día pintado de color fuerte, leyenda con `.cal-legend`, panel del día en la compu; ver mockup.

## Trampas ya encontradas

- Todo lo `position: fixed` dentro de una pantalla (botón +, hojas) va con `Floating` (portal al body): la pantalla se anima y se desliza con transform, que corre a los fijos.
- Deslizar entre secciones (`Shell.tsx`) escucha en todo el documento (con poco contenido, lo vacío de abajo no es `<main>`) e ignora gestos que empiezan en la barra de abajo, hojas, `.cal-wrap`, campos, tiras con scroll horizontal o `[data-noswipe]`. Se sacó deslizar fila (completar/borrar) a pedido del usuario: molestaba y competía con cambiar de sección.

- Choques de nombres de clase global: `.grab` (lo usa `calendar.css`) y `.pill` (filtros). Por eso la manija de la hoja es `.sheet-grab` y la píldora de la barra de abajo `.nav-pill`. Antes de crear una clase, `grep` en `modules/*/web/*.css`.
- En `CoreContext.tsx` la variable `m` es la lista de materias: Motion se importa como `mo`.
- PowerShell 5.1 muestra mal los acentos de archivos UTF-8 (solo es la consola); los archivos están bien. Para reemplazos masivos usar `Edit`, o `Get-Content -Raw -Encoding utf8` / `Set-Content -Encoding utf8 -NoNewline`.
- `WEB_DIST` del servidor tiene que ser una ruta absoluta.

## Herramientas para probar

- Servidor de prueba con datos de ejemplo (no toca `data/`): `npm run build`, luego `DB_PATH=<scratchpad>\demo.sqlite WEB_DIST=C:\PROYECTS\study-workflow\dist\web PORT=3999 HOST=127.0.0.1 node core/server/main.ts`. El `seed.mjs` (en el scratchpad de la sesión, puede haberse borrado) carga 4 materias, tareas, eventos y fechas de finales con `POST` a `/api/materias`, `/api/todo`, `/api/calendar/events`, `/api/finals/dates`.
- Capturas: Playwright 1.65 instalado en `<scratchpad>\pw` (Chromium); se usó con viewports 412×892 y 1440×900.
- Celu: Samsung S25 Ultra (`<serie>`) conectado por USB con depuración. `adb`: `C:\Users\<usuario>\AppData\Local\Android\Sdk\platform-tools\adb.exe` (no está en el PATH). Para instalar un APK de prueba hay que correr `npm run apk` (ver `docs/android.md`); la etapa 4 lo necesita para probar hápticos y gestos reales.
- Al terminar cada etapa: `npm run typecheck`, `npm test` (230 tests pasaban en la etapa 2), `npm run build`.

## Riesgos abiertos

- La etapa 2 no se probó en un celu real; la vibración con `navigator.vibrate` puede no sentirse en el APK.
- El cambio de pantalla solo anima la entrada (sin salida) por el problema de react-router con rutas en salida.
- Sin cambios en formatos de importación (`docs/formato-importacion.md`, `docs/formato-finales.md`): no hay que tocar las skills del usuario.
