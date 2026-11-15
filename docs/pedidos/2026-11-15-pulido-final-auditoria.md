# Pulido final — Etapa 1: auditoría

Hecha leyendo el código (núcleo, To-do, Calendario, Ajustes, Android) y calculando contrastes. **No se corrió** axe, Lighthouse, TalkBack ni nada en el celu: lo que depende de eso figura como "a verificar" y se mide en la etapa 2.
Leyenda: ✔ está bien · ✎ hay que ajustar · ✚ falta.

## Lista priorizada

### Impacto alto
1. ✎ **Borrar con `confirm()` nativo** (tarea y evento: `TodoEditPage.tsx:73`, `EventEditPage.tsx:86`). Va contra "deshacer en lugar de confirmar" y se ve feo en el APK. Pasar a borrar + aviso "Deshacer" (hay que poder recrear la tarea/evento con el mismo contenido).
2. ✚ **Doble envío**: ni `save` de tarea/evento/materia/finales ni el alta rápida tienen estado "guardando". Tocar dos veces crea duplicados. Hay que deshabilitar mientras guarda.
3. ✚ **Cambios sin guardar**: ninguna pantalla avisa al salir.
4. ✎ **Sheet sin foco atrapado** (`ui.tsx:66`): tiene `aria-modal` pero Tab sale hacia atrás de la hoja. Los `<dialog>` nativos sí atrapan. Falta atrapar y marcar el resto como inerte.
5. ✎ **Ajustes dice algo falso**: "Si el sistema tiene 'Reducir movimiento' activado, arranca en 'Sin animaciones'", pero `prefs.ts` decidió a propósito **no** seguirlo (Windows lo activa solo). Hay que decidir (ver abajo) y alinear texto y código.
6. ✚ **Estructura de Ajustes** (sección 3 entera): hoy hay Materias, Módulos, Movimiento/vibración, Texto, Servidor y el panel de Calendario. Faltan General, Tareas, Recordatorios, Apariencia (acento), Datos (exportar/importar backup, vaciar copia offline) y Acerca de + Novedades. Exportar/importar necesita endpoints nuevos en el server.
7. ✚ **Fechas legibles**: `formatDate` solo da `dd/mm/aaaa`; no hay "Hoy / Mañana / En 3 días / Vencida hace 2 días". Hoy se ve "venció 12/11".
8. ✚ **Selectores de fecha y hora propios**: hay 10 `<input type=date|time>` nativos (Tarea, Evento, Finales). Es el ítem más grande; se hace sin dependencias, con un componente propio compartido.
9. ✎ **Medianoche**: `todayAR()` se calcula al renderizar; con la app abierta pasada la medianoche "Hoy" y las vencidas quedan desactualizadas hasta que algo re-renderice.
10. ✎ **Tamaño de letra**: `--fs` escala el texto, pero quedan ~8 `font-size` en px fijo (barra de abajo 12px, `.kbd` 11px, regla de días 10.5px, etc.). Además hay que verificar si el WebView del APK sigue la letra del sistema (Capacitor suele fijar 100%): **a verificar en el celu**.

### Impacto medio
11. ✚ **Onboarding**: no hay. Con 0 materias solo sale un texto en Ajustes. Pantalla de primera vez: conectar server (ya existe `ConnectScreen`), crear materias, cómo importar un plan; salteable.
12. ✚ **Búsqueda global** (`/` o Ctrl+K): no existe. Hay atajos `1…n` y `N` en `Shell.tsx`. Requiere endpoint de búsqueda o filtrar lo ya cargado.
13. ✎ **Estados de carga/vacío/error**: Inicio, To-do y edición tienen skeleton y vacío con ícono ✔. **Calendario no tiene skeleton** (la grilla arranca vacía y se llena). Error: cada pantalla arma su propio `<p class=error>` + "Reintentar"; conviene un `ErrorState` único en `ui.tsx` (como `EmptyState`). Sin conexión: barra superior ✔ pero Ajustes bloquea todo menos dispositivo. Finales, Planes e Importar: **a verificar** si cubren los cuatro estados.
14. ✎ **Anuncios para lector de pantalla**: el toast y la barra offline ya son `role=status` ✔. Faltan: avisar cuando una tarea se completa/borra (solo cambia lo visual), el contador de la lista y los errores de formulario (los de tarea/evento salen por toast, no junto al campo; no hay validación en línea).
15. ✎ **Roles ARIA** puntuales: swatches y radios de Ajustes son `role=radio` sin navegación con flechas; `.cal-legend` tiene `aria-label` en un `div` sin rol (axe lo marca); `aria-disabled` deja los botones enfocables (está bien, pero hay que confirmar que el lector diga "no disponible").
16. ✎ **Teclado en el celu tapando el campo**: no hay manejo explícito (`interactive-widget` / `windowSoftInputMode`): **a verificar** en el S25 en Tarea y Evento.
17. ✎ **Textos**: revisión pendiente de todas las pantallas. Ya vi mezcla de tonos ("sigue sonando hasta que la atiendas" ✔ voseo; "Probar y guardar", "Algo salió mal." sin decir qué hacer, "No se pudo cargar"). Se hace en un solo barrido.
18. ✎ **Rendimiento/bundle**: un solo JS de **943 KB (287 KB gzip)** + CSS 59 KB (12 KB gzip). FullCalendar (solo se usa en Semana) y dnd-kit son los candidatos a cargar bajo demanda con `import()` (sin dependencias nuevas). Listas largas: sin virtualización y cada fila es un `m.li` con animación de layout dentro de un `DndContext` por grupo; con 200+ tareas puede trabarse: **medir antes de tocar**.
19. ✎ **Splash**: fondo del splash `#10131A` vs `--bg` web `#0e1117`: se ve un salto de color al abrir. Unificar.

### Impacto bajo / terminación
20. ✚ **PWA y favicon**: `web/index.html` no tiene favicon, `theme-color`, manifest ni service worker. Título fijo "Study Workflow" (no cambia por pantalla). Instalable como app de escritorio requiere manifest + ícono 192/512 (el service worker no hace falta para el criterio de instalación actual de Chrome en escritorio, pero lo verifico en Lighthouse).
21. ✎ **Ícono Android**: adaptativo + monocromático ya existen (`ic_launcher.xml`), pero el monocromático reutiliza el mismo trazo de color y el diseño es un contorno fino (4–5 dp) que a tamaño chico pierde presencia. Revisar con el launcher del S25.
22. ✎ **Barra de estado/navegación**: `SystemBars` con `style: 'DARK'` y fondo por CSS ✔; falta `theme-color` en la web.
23. ✎ **Casos límite ya cubiertos**: título largo (2 líneas con corte) ✔, materia de nombre largo en Ajustes (elipsis) ✔. **A probar**: 0 materias en todas las pantallas, varios exámenes el mismo día en la celda del mes (hoy muestra uno + "+N"), leyenda del calendario con muchas materias, cambio de año en Próximas.
24. ✎ **Consistencia**: botones `.btn` tienen 48 px en celu y 40 px en compu fino (ok); `.seg button` 44; checkbox/radio de 22 px dentro de label de 44 ✔. Revisar que el widget use los mismos colores de materia/acento (hecho en el último commit, a verificar con acento configurable).
25. ✚ **Novedades / versión**: no hay número de versión visible ni changelog.
26. ✚ **QA automatizado**: no hay Playwright ni axe instalados. Se agregan como dependencias de desarrollo (axe-core vía `@axe-core/playwright` y `@playwright/test`), justificadas por el pedido.

## Ya está bien ✔
- **Contraste** (calculado): texto `--muted` 8.3:1 sobre fondo, `--faint` 5.4:1 sobre tarjeta (4.9:1 sobre `--surface-2`), `--late` 9.1:1, `--entrega` 12.3:1, acento 10.2:1, botón del toast 6.4:1. **Blanco sobre los 12 tonos fuertes: 4.8–6.3:1**, todos pasan AA. Pendiente solo: el pastel sobre su propia mezcla al 18 % en chips (medir con axe) y el interruptor apagado (`--faint` sobre tarjeta 5.4:1 ✔ como componente).
- **Zonas táctiles**: checkbox de fila 44 px, `icon-btn` 44, pills 44, swatches 48, FAB y nav ≥ 44.
- **Foco visible**: regla global `:focus-visible` con anillo y halo ✔; inputs con borde de acento.
- **Teclado en la compu**: dnd-kit con `KeyboardSensor` ✔, `Esc` y retorno de foco en la Sheet ✔, `<dialog>` nativo con foco atrapado ✔, atajos `1…n` y `N`.
- **No depender del color**: categorías con ícono + texto ✔, vencidas con ícono de reloj + "venció" ✔, exámenes con etiqueta ("PARCIAL · …") y ícono por tipo en el detalle ✔, completadas con tachado + tilde ✔, celdas del calendario con `aria-label` completo ✔.
- **Movimiento**: "Sin animaciones" apaga CSS (`!important`), shimmer y `MotionConfig reducedMotion='always'`; los gestos usan `spring()` que depende de la velocidad elegida.
- **Etiquetas**: botones solo ícono con `aria-label` ✔, checkbox de tarea con `aria-pressed` y texto "Completar: …" ✔, switches con `role=switch` ✔, mes del calendario con `aria-live` ✔.
- **Deshacer**: ya existe el toast con "Deshacer" (6 s), tildado con 1,5 s para revertir y deshacer en Finales.
- **Estados**: skeleton en Inicio/To-do/edición, vacíos con ícono SVG (sin emojis) y acción, "Reintentar" en errores de carga, barra de sin conexión.

## Decisiones que necesito de vos
1. **"Reducir movimiento" del sistema**: ¿lo respetamos de verdad (arranca en "Sin animaciones" si el sistema lo pide, y vos podés subirlo a mano) o mantenemos el criterio actual y corrijo solo el texto de Ajustes? Recomiendo respetarlo **solo en el APK** (Android no lo activa solo, Windows sí) y arreglar el texto.
2. **Selector de fecha/hora propio**: es el cambio más grande de la etapa 2 (un componente compartido, sin dependencias). ¿Va en la etapa 2 o lo dejamos para la 4?
3. **Búsqueda global y exportar/importar backup** necesitan API nueva en el server (contrato de módulos). ¿Los hago como parte del núcleo (`core/server`)? Recomiendo sí, mínimos.

## Propuesta de reparto
- **Etapa 2 (accesibilidad y estados):** 1, 2, 3, 4, 5, 7, 9, 10, 13, 14, 15, 16, 17 (+ 8 si decidís que va acá) y axe en Playwright (26) para medir antes/después.
- **Etapa 3 (Ajustes y onboarding):** 6, 11, 12, 25.
- **Etapa 4 (terminación y calidad):** 18, 19, 20, 21, 22, 23, 24, capturas, Lighthouse y checklist del S25.
