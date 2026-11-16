# Cambios de uso por versión

Lo que cambió para quien usa la app en cada pedido. La lista corta de cada versión está también en la app (Ajustes › Acerca de › Novedades).

## Qué cambió de uso (Hito C)

- **Inicio**: pantalla de entrada con tarjetas de Hoy (tiempo pendiente de tiempo total), próximo examen y próximos 7 días.
- **Sigla**: cada materia tiene una sigla de hasta 5 letras (se sugiere sola; editable en Ajustes) que se usa en los chips.
- **Duración y categoría**: cada to-do puede llevar duración estimada y categoría (tarea, entrega, estudio); el tiempo se suma por día y por materia.
- **Importar**: la vista previa muestra duración y categoría; el formato pasó a v2 (ver [docs/formato-importacion.md](docs/formato-importacion.md)).

## Qué cambió de uso (observaciones 14/11)

- **Finales** (pantalla nueva): cargás las fechas posibles de cada materia (a mano o pegando el JSON de la skill, ver [docs/formato-finales.md](docs/formato-finales.md)), filtrás y ordenás las combinaciones y elegís una. Elegir crea los eventos `final` en el calendario; "Deshacer" los borra.
- **Subtareas**: una tarea puede tener subtareas. En las listas y en el widget se ve el progreso (`2/4`); tocando ese contador (en To-do y en Inicio › Hoy) se despliegan debajo de la tarea y se tildan ahí mismo (o abriendo la tarea), y tildarlas todas completa la principal. Sin conexión solo se tilda la principal.
- **Recordatorios**: tareas (con fecha) y eventos pueden sonar en el celu a la hora, 15 min, 1 h o 1 día antes, o un tiempo a elección. Con "Insistente" sigue sonando hasta que la atiendas. Detalles en [docs/android.md](docs/android.md).
- **Atrás en el celu**: vuelve dentro de la app; sin historial va a la pantalla padre y recién desde una pantalla principal minimiza.
- **Compu**: To-do tiene siempre el panel de la derecha (editar o nueva tarea) y las pantallas usan el ancho.
- **Agenda**: se sacaron el widget Agenda y la vista Agenda del calendario (quedan Mes y Semana).
- **Importar**: el formato pasó a v3 (subtareas).

## Qué cambió de uso (pulido UX/UI)

- **Navegación del celu**: abajo quedan Inicio, To-do, Calendario y **Más** (Finales, Importar y Ajustes). En la compu, barra lateral con todas las secciones y Ajustes abajo.
- **Gestos (celu)**: deslizar a los costados en cualquier parte (menos sobre la grilla del calendario, que cambia de mes) pasa entre Inicio, To-do y Calendario. Las tareas ya no se completan ni se borran deslizándolas: se tildan con el cuadradito y se borran desde su pantalla. Tirar hacia abajo en To-do o Calendario refresca. La hoja del día se cierra arrastrándola hacia abajo. Reordenar sigue siendo mantener apretado y arrastrar.
- **Atajos (compu)**: `1`…`n` cambian de pantalla (el número aparece al pasar el mouse por la barra lateral), `N` nueva tarea, `Esc` cierra hojas.
- **Agregar tarea**: en el celu, con el botón flotante; en la compu, con el campo de arriba de la lista (Enter) o el panel.
- **Ajustes de este dispositivo** (no se sincronizan): velocidad de animaciones (o "Sin animaciones"), vibración (solo APK, con los efectos nativos del celu: suave, media o fuerte) y tamaño de letra.
- **Widget To-do**: mismo estilo que la app (cuadradito y barra con el color de la materia, segunda línea con sigla, hora o "venció" y subtareas, botón + para nueva tarea; tocar "To-do" abre la lista).
- **Finales**: los filtros y el orden van plegados en "Filtros y orden"; el resumen muestra lo aplicado.
- **Ajustes › Materias**: tocar la fila edita; el ícono de la derecha archiva.

## Qué cambió de uso (pulido final, etapa 2)

- Fechas y horas se tipean (`5/11`, `hoy`, `mañana`, `930`) o se eligen en un calendario propio (botón del calendario, flechas, Enter).
- Borrar una tarea o un evento ya no pregunta: avisa y deja "Deshacer" 6 s.
- Si salís de una tarea o evento con cambios sin guardar, avisa.
- "Reducir movimiento" del sistema arranca la app en "Sin animaciones" (se cambia en Ajustes).
- Las fechas se leen "Hoy", "Mañana", "En 3 días", "Vencida hace 2 días".

## Qué cambió de uso (pulido final, etapa 3)

- **Ajustes** en secciones: General (pantalla de inicio, guía), Materias, Módulos, Tareas (duración, categoría y ocultar completadas), Calendario, Recordatorios (anticipación e insistente por defecto, probar sonido), Apariencia (letra, color de acento, animaciones, vibración), Datos, Servidor y Acerca de (versiones y Novedades).
- **Búsqueda global** de tareas y eventos: `/` o Ctrl+K en la compu; "Buscar" en el menú Más del celu.
- **Backup**: Ajustes › Datos › Exportar baja un .json con todo; Importar lo restaura (reemplaza todo; el servidor guarda antes una copia en `/data/backups/pre-import-*.sqlite`).
- **Guía de primera vez** (3 pasos, salteable); se reabre desde Ajustes › General.

## Qué cambió de uso (pulido final, etapa 4)

- Ícono nuevo y splash del mismo color que la app. En Android 13+ el ícono acompaña el tema si activás "Íconos temáticos".
- La web se puede instalar como app (Chrome › ⋮ › Instalar) y la pestaña muestra la pantalla en la que estás.
- Con muchas tareas en un grupo, el To-do muestra 30 y un botón "Mostrar más".
- El checklist para probar en el celu está en `docs/checklist-s25.md`; los números de rendimiento, en `docs/pedidos/2026-11-15-pulido-final-etapa4.md`.

## Qué cambió de uso (1.1.0)

- **Versiones**: la app usa versión semántica. La única fuente es `version` en `package.json`; la toman la web, el server (`/api/health`) y el APK (`versionName`; `versionCode` = X·1000000 + Y·1000 + Z). Cada pedido sube la versión y suma su entrada en `core/web/novedades.ts` (un test exige que coincidan). Ajustes › Acerca de muestra "Versión X.Y.Z · fecha" y la versión del servidor.
- **Tema**: Ajustes › Apariencia › Tema: Oscuro (por defecto), Claro o Según el sistema. Es de cada dispositivo. El widget, el splash y las barras del celu lo siguen.
- **Semana**: grilla propia (ya no usa FullCalendar). En el celu se ven 3 días con la tira de la semana arriba: deslizá para moverte de a 3 días o tocá un día de la tira. Tocá un hueco para ver "+ HH:MM" y tocalo de nuevo para crear un evento a esa hora. Las tareas sin hora van en "Todo el día"; tocá el día o "+N más" para ver el detalle.
- **Finales**: tres pasos en una pantalla: "¿Qué rendís?" (chips de materias), "Fechas posibles" (una fila por materia; tocá una fecha para editarla o + para agregar) y "Combinaciones" (filtros como chips arriba, la mejor con su mes dibujado y el resto con solo lo que cambia resaltado). Tocá una combinación para verla arriba. Importar fechas se abre en una hoja.

## 2.0.0-beta.2 (base de sincronización)

Sin cambios de uso todavía: se agregó el motor de sincronización, el almacenamiento local y las rutas `/api/sync/*` del servidor (ver [docs/sync.md](sync.md)).

## 2.0.0-beta.3 (módulos en la app)

- Todo corre en el dispositivo: sin conexión se puede crear, editar, borrar e importar. No hay más acciones bloqueadas ni "copia offline".
- Sincronización automática con el servidor (al abrir, al volver la red, cada 5 min, 2 s después de un cambio). Estado y "Sincronizar ahora" en Ajustes › Datos.
- Backup nuevo (formato v2, solo registros). Los backups de la 1.x se convierten en la migración (etapa 5).
- El servidor ya no tiene `/api/todo`, `/api/calendar`, etc.: solo `/api/sync/*` y `/api/health`.
- Pendiente (etapa 4): widget y recordatorios del celu leyendo del dispositivo.

## 2.0.0-beta.4 (widget y recordatorios desde el dispositivo)

- El widget y los recordatorios leen los datos del celu (no del servidor): funcionan sin conexión y se actualizan al instante con lo que hacés en la app.
- Tildar en el widget se guarda en el celu y se sube solo cuando hay conexión; ya no hay cola aparte ni regla "gana el servidor": gana el cambio más nuevo.
- Los cambios de la compu llegan al widget y a las alarmas en segundo plano, sin abrir la app.
- Los recordatorios de eventos que se repiten se calculan en el celu.
- Sin dirección del servidor la app y el widget andan igual (solo local).

## 2.0.0-beta.5 (migración)

- `node scripts/migrar-local-first.mjs <backup-v1.json>` convierte tus datos de la 1.x (con informe antes/después y ida y vuelta) y, con `--cargar`, los sube a un server 2.0. `--a-v1` hace la vuelta atrás. Guía completa: [migracion.md](migracion.md).
- `npm run deploy -- --next` y `npm run apk -- --next`: la versión de prueba vive al lado de la real.

## 2.0.0 (local-first)

Versión final de la serie 2.0.0-beta: la app corre en el dispositivo y el servidor solo sincroniza. Los cambios de uso de cada etapa están arriba (2.0.0-beta.2 a beta.5). Migración desde la 1.x y vuelta atrás: [migracion.md](migracion.md).

## Qué cambió de uso (2.1.0-beta.2, Google Drive en la web)

- **Web pública (GitHub Pages)**: la misma app sin servidor. Ajustes › **Google Drive** › Conectar guarda y sincroniza tus datos en una carpeta oculta de tu Drive (permiso `drive.appdata`). Al conectar, lo que ya tenías en el dispositivo se junta con lo que haya en el Drive. Configuración de Google: [docs/google-cloud.md](google-cloud.md). Mi web en mi server no cambia.
- **Reconectar**: en la web, Google renueva el permiso solo con un toque cada ~1 hora; aparece "Reconectar" arriba y los cambios quedan guardados en el dispositivo mientras tanto.
- **Página de privacidad** (`/privacidad.html`) y web instalable que abre sin conexión.
- `npm run pages` arma y audita el sitio; `npm run pages -- --publish` lo sube a la rama `gh-pages`.
