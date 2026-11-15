# Pedido: pulido final (calidad "lista para publicar")

La app ya está casi terminada. Quiero que quede **100 % pulida, como si la fuera a publicar**. Este pedido no suma funciones grandes: revisa, completa y corrige.

**Primero auditá y después proponé.** No rehagas lo que ya está bien. Para cada punto de abajo, marcá: ✔ ya está bien / ✎ hay que ajustar / ✚ falta. Pasame la lista priorizada (impacto alto primero) y esperá mi OK antes de tocar código.

## 1. Accesibilidad

- **Lector de pantalla (TalkBack en el S25):** labels, roles y estados correctos en todos los controles (checkbox de tarea, chips, días del calendario, toggles, botones solo con ícono). Los avisos ("Deshacer", "Sin conexión", errores) se anuncian (`aria-live`). Orden de lectura lógico.
- **Tamaño de letra del sistema:** con la letra de Android al máximo y con el ajuste "grande" de la app, nada se corta, se superpone ni se sale de la pantalla.
- **Contraste AA** en todo, incluidos los pastel sobre fondo, los textos atenuados, los deshabilitados y el texto blanco sobre los tonos fuertes.
- **No depender solo del color:** exámenes, vencidas y categorías se distinguen también con ícono o texto.
- **Teclado en la compu:** todo se puede usar sin mouse. Foco visible y lindo, orden de tabulación lógico, foco atrapado dentro de diálogos y hojas, Esc cierra y el foco vuelve a donde estaba.
- **Movimiento:** "Sin animaciones" y `prefers-reduced-motion` desactivan de verdad todo, incluidos los gestos con inercia.
- **Zonas táctiles** de 44–48 px y separación suficiente entre acciones destructivas y normales.

## 2. Estados y flujos (UX)

- **Todos los estados de cada pantalla:** carga (skeleton), vacío (con texto útil, un ícono o ilustración simple en SVG, sin emojis, y la acción para empezar), error (qué pasó y "Reintentar") y sin conexión. Consistentes en toda la app.
- **Primera vez (onboarding corto):** conectar el server, crear materias y explicar en 2 o 3 pasos cómo importar un plan. Que se pueda saltear.
- **Deshacer en lugar de confirmar** para acciones reversibles (borrar tarea, completar, borrar plan). Confirmación solo para lo irreversible.
- **Formularios:** validación en línea con mensajes claros, botón deshabilitado mientras guarda (sin doble envío), aviso si salís con cambios sin guardar, y que el teclado del celu no tape el campo activo.
- **Selectores de fecha y hora propios**, coherentes con el diseño, en lugar de los nativos del navegador.
- **Fechas legibles:** "Hoy", "Mañana", "En 3 días", "Vencida hace 2 días", además de `dd/mm`.
- **Búsqueda global** de tareas y eventos (en la compu con "/" o Ctrl+K).
- **Textos:** revisión de todos los textos de la app. Voseo rioplatense, tono consistente, sin jerga técnica, botones con verbo ("Guardar", "Importar") y mensajes de error que digan qué hacer.

## 3. Configuración (Ajustes)

Organizá Ajustes en secciones claras y agregá lo que falte:

- **General:** pantalla de inicio al abrir (Inicio / To-do / Calendario).
- **Tareas:** duración por defecto, categoría por defecto, qué hacer con las completadas (ocultar después de N días).
- **Recordatorios:** anticipación por defecto, "Insistente" por defecto, y un botón para probar el sonido.
- **Apariencia:** tamaño de letra, velocidad de animaciones, intensidad de la vibración (ya pedidos) y color de acento (unas pocas opciones de la paleta).
- **Datos:** exportar todo a un archivo JSON (backup), importar ese backup y vaciar la copia offline del celu.
- **Acerca de:** versión de la app y del server, fecha del build y una pantalla "Novedades" con los cambios de cada versión.

## 4. Terminación de producto

- **Ícono y splash:** ícono adaptativo de Android bien hecho (incluido el monocromático para íconos temáticos), splash coherente, barra de estado y barra de navegación del color del fondo, y áreas seguras respetadas.
- **Compu:** favicon, título de la pestaña según la pantalla, que se pueda instalar como app de escritorio (PWA) con su ícono, y que se vea bien entre 1024 y 2560 px de ancho.
- **Casos límite:** títulos muy largos, 0 materias, más de 200 tareas, varios exámenes el mismo día, una materia con nombre largo, cambio de año y medianoche.
- **Rendimiento:** arranque rápido del APK, listas largas fluidas, sin saltos de layout al cargar y un tamaño de bundle razonable (reportame cuánto pesa y qué se puede recortar).
- **Consistencia final:** mismos componentes, espaciados, radios, íconos, animaciones y vibraciones en todas las pantallas, incluido el widget.

## 5. Control de calidad

- **Auditoría automática de accesibilidad** con axe en Playwright, en todas las pantallas, a 412 y 1440 px. Dependencia de desarrollo, justificada.
- **Capturas de todas las pantallas y estados** (vacío, carga, error, sin conexión) a 412 y 1440 px, guardadas en `docs/capturas/` para comparar.
- **Lighthouse** de la versión web: reportame accesibilidad, buenas prácticas y rendimiento.
- **Checklist manual para mí** en el S25: TalkBack, letra grande, modo avión, recordatorios, widget y gestos.

## Cómo trabajar

- Etapas: (1) auditoría + lista priorizada; (2) accesibilidad y estados; (3) Ajustes y onboarding; (4) terminación de producto y calidad. **Frená al final de cada una.**
- Sin subagentes, una sola revisión al final de cada etapa, Context7 una vez por librería, respuestas cortas.
- Al terminar cada etapa, pasame qué mirar y los comandos de deploy y de APK si hacen falta.
