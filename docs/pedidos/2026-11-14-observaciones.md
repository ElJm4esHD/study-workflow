# Pedido: observaciones de uso (14/11/2026)

Observaciones de usar la app unos días. Hacé **un solo diseño corto para todo**, preguntame solo lo indispensable, esperá mi OK y ejecutá **en este orden**, con un commit por bloque.

## Bloque 1: arreglos (rápidos)

1. **APK: barra negra "Study Workflow" arriba.** En la app del celu aparece una barra negra con el título "Study Workflow" que **tapa** el contenido (no lo corre hacia abajo). Sacala: la app tiene que arrancar directo con su propia interfaz, respetando la barra de estado del sistema.
2. **Editar tarea: no abrir el teclado.** Al tocar una tarea para editarla (en el celu), el foco va solo al campo de duración y se abre el teclado. Al abrir la edición, ningún campo tiene que tener foco automático.
3. **Títulos largos en la lista.** En el celu muchos títulos se cortan y no llego a leerlos. En las listas de tareas, que el título pueda ocupar hasta 2 líneas antes de cortarse.
4. **Botón Atrás desde el widget.** Si entro a una tarea tocándola en el widget y aprieto Atrás en el celu, me manda a la pantalla de inicio del celu. Tiene que volver a la lista. Regla general: si no hay historial dentro de la app, Atrás va a la pantalla "padre" (de `/todo/:id` a `/todo`, del detalle de un día al calendario) y recién desde una pantalla principal sale de la app.
5. **Compu: usar todo el ancho.** En la compu las pantallas siguen sin aprovechar el ancho y queda espacio vacío. La UI está bien; es un tema de layout. Que cada pantalla use el ancho disponible con sentido (más columnas, paneles laterales), no contenido angosto en el medio o a la izquierda.
6. **Sacar la Agenda.** No la uso: eliminá el widget Agenda y la vista Agenda del calendario (quedan Mes y Semana). Limpiá el código que quede sin uso.

## Bloque 2: planificador de finales (módulo nuevo, prioridad alta: tengo finales en diciembre)

Objetivo: ver todas las combinaciones posibles de fechas de finales y elegir la mejor.

- **Carga de fechas:** la facultad publica las fechas disponibles (cada materia tiene varias fechas posibles, a veces con hora). **No hagas lectura de imágenes dentro de la app.** La carga funciona como "Importar plan": le paso la captura a Claude en un chat y una skill la convierte a JSON. Definí ese formato (materia y lista de fechas/horas posibles), con el mismo criterio de contrato que el de planes, y documentalo en `docs/`. También tiene que poder cargarse y editarse a mano en la app.
- Elegir qué materias voy a rendir.
- **Ver todas las combinaciones posibles** (una fecha por materia), de forma visual y fácil de comparar; por ejemplo, una línea de tiempo por combinación con el color de cada materia.
- **Filtros:** mínimo de días entre finales, terminar antes de una fecha, excluir fechas o rangos. **Orden:** más días entre finales, terminar antes, etc.
- Elegir una combinación crea los eventos `final` en el calendario, y se puede deshacer.

## Bloque 3: subtareas

Una tarea puede tener subtareas. Ejemplo: la tarea "Hacer 1.2, 1.3, 4.5 y 7.2", con una subtarea por ejercicio. Así la lista principal queda limpia.

- En las listas se ve solo la tarea principal con su progreso (por ejemplo, 2/4). Al tocarla, se ven y se tildan las subtareas.
- Tildar todas las subtareas completa la tarea principal.
- En el widget To-do se ve la tarea principal con su progreso.
- **Formato de importación:** agregá subtareas opcionales a los ítems `tarea`. Subí la versión y seguí aceptando las anteriores.

## Bloque 4: recordatorios en el celu

Como la app Reminder de Samsung: poder ponerle a una tarea o a un evento un recordatorio que suene en el celu.

- Elegir cuánto antes suena (a la hora, 15 min antes, 1 h antes, 1 día antes o personalizado) y si se repite.
- Que funcione sin conexión y con la app cerrada.
- Ideal: con sonido, tipo alarma. Si en Android eso no es viable o confiable, alcanza con una notificación con sonido. **Decime qué se puede antes de implementarlo.**
- Que no se dupliquen ni queden recordatorios de tareas borradas o completadas.

## Al terminar

Frená y pasame:
- la checklist de prueba (celu y compu);
- los comandos de deploy y de APK;
- los textos exactos para mis skills: el formato nuevo de finales y los cambios del formato de planes (subtareas).
