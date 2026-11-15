# Pulido final — Etapa 4: terminación de producto y calidad

## Qué se hizo
- **Ícono y splash:** ícono nuevo (casilla de acento con tilde oscuro), adaptativo con versión monocromática propia para íconos temáticos. El splash y el fondo de la ventana pasaron de `#10131A` a `#0E1117` (el mismo de la web). El mismo dibujo genera el favicon y los íconos de la web (`node scripts/icons.mjs`).
- **Compu:** favicon, `theme-color`, `manifest.webmanifest` (la app es instalable: Chrome no informa errores de instalabilidad) e ícono para pantalla de inicio. Título de la pestaña según la pantalla ("To-do · Study Workflow", "Nueva tarea · …").
- **Pantallas anchas:** el contenido se centra y llega a 1440 px de ancho como máximo (a 2560 px quedaba estirado). A 1024 px la lista del To-do se metía debajo del panel de edición: arreglado.
- **Color de acento en el widget:** el contador y el botón + toman el acento elegido en Ajustes.
- **Casos límite:** título larguísimo (corta a 2 líneas), materia con nombre largo, 5 exámenes el mismo día (el detalle los lista a todos), 220+ tareas (el To-do dibuja de a 30 por grupo con "Mostrar más"), medianoche (el "Hoy" se actualiza solo) y 0 materias (guía de primera vez y estados vacíos).
- **Consistencia:** un token más para los radios (`--r-sm`) y colores del aviso en variables. Íconos en 16/18/20 px, radios y espaciados de la escala. El widget usa los mismos colores que la web.
- **Calidad:** capturas de todas las pantallas y estados en `docs/capturas/` (`npm run capturas`), auditoría axe (`npm run a11y`), Lighthouse y checklist del S25 (`docs/checklist-s25.md`).

## Rendimiento
| | Antes | Después |
|---|---|---|
| JS inicial (sin comprimir) | 953 KB | 677 KB |
| JS inicial (gzip) | 293 KB | 216 KB |
| Vista Semana (FullCalendar + temporal-polyfill) | dentro del inicial | 295 KB, se baja solo al abrir Semana |
| CSS inicial (gzip) | 12.7 KB | 9.6 KB (+3.8 KB al abrir Semana) |
| Lighthouse móvil (3G lento, CPU 4x) | rendimiento 59 | **91** (FCP 2.0 s, LCP 2.6 s, TBT 230 ms, CLS 0) |
| Lighthouse escritorio | 95 | **100** |
| Accesibilidad / buenas prácticas | 100 / 100 | 100 / 100 |

Lo que más pesó: el servidor no comprimía. Ahora responde con Brotli o gzip (zlib de Node, sin dependencias): la web pasó de 59 a 91 en móvil. Sacar FullCalendar del inicio ahorró otros 276 KB sin comprimir.

**Qué más se podría recortar** (sin hacerlo ahora): lo que queda del inicial es React (620 KB de fuente), el motor de animaciones motion (655 KB de fuente; hace falta la versión con arrastre y layout), react-router (368 KB) y dnd-kit (122 KB). Un recorte grande implicaría cambiar de librería; no vale la pena para un solo usuario.

**Listas largas** (medido con CPU 4 veces más lenta que la compu, que se parece a un celu): con 120 filas dibujadas, primera fila a los 1.3 s en 412 px y 1.0 s en 1440 px; la mayor parte es arrancar el JS y no las filas. En la compu sin throttling, 354 filas aparecen en 330 ms.

## Pendiente (a propósito)
- `valid-source-maps` y `unused-javascript` de Lighthouse son informativos: el JS no usado es mayormente la parte de React que no se ejecuta al inicio.
- El APK no tiene íconos para Android 7 o anterior (mínimo soportado: Android 8).
