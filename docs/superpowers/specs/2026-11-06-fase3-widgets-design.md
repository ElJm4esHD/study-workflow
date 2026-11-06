# Fase 3: widgets To-do y Agenda (Jetpack Glance)

Fecha: 06/11/2026. Va después de la Fase 2 (APK, deployado y probado en el S25).
Marcas: **[usuario]** = lo decidió Federico (en CLAUDE.md o en la charla). **[mía]** = decisión mía, revisable.

## 1. Por qué y qué es éxito

Federico usaba el widget de Samsung Reminder y quiere lo mismo para su app: mirar la pantalla de inicio del celu, ver qué tiene pendiente y tildar sin abrir nada. **[usuario]**

**Éxito:**
- Dos widgets en la pantalla de inicio del S25: To-do y Agenda.
- Scroll y tildado dentro del widget, sin abrir la app.
- Se ven como la app (Hito C).
- Siguen mostrando lo último sin conexión, y los tildes hechos sin señal se mandan solos al volver la red.

## 2. Objetivos, no-objetivos, anti-objetivos

**Objetivos**
- Widget To-do y widget Agenda, nativos, en Kotlin + Jetpack Glance. **[usuario]**
- Interactivos dentro del widget: scroll y checkbox. **[usuario]**
- Redimensionables. **[usuario]**
- Estilo del Hito C. **[usuario]**
- Reusar lo que ya existe **[usuario]**:
  - `/api/todo` y `/api/calendar/agenda`;
  - los links directos `/todo/:id`, `/todo/nueva` y `?dia=`;
  - la regla de la cola offline de tildes.
- Se refrescan cuando la app cambia datos y también periódicamente. **[usuario]**

**No-objetivos**
- Crear o editar desde el widget. El "+" abre la app.
- Tema claro o Material You. CLAUDE.md decía "tema según el sistema", pero Federico eligió el estilo oscuro del Hito C. **[usuario]**
- Widget de próximo examen o cuenta regresiva.
- Notificaciones.

**Anti-objetivos**
- Que tildar requiera abrir la app, o accesos directos del ícono en lugar de un widget. **[usuario]**
- Perder un tilde hecho sin señal, o que un tilde viejo pise un cambio más nuevo hecho desde la compu. **[usuario]**
- Un widget recargado de texto: el To-do no muestra fechas. **[usuario]**
- Tocar los otros módulos más allá del punto de enganche que marca la sección 5.

## 3. Constraints

- **Proyecto `android/` existente:** Capacitor 8, Java (`MainActivity`, `SharedTextPlugin`), AGP 8.13, `minSdk` 24, `compileSdk` y `targetSdk` 36.
- Los widgets van en **Kotlin**. Lo existente queda en Java.
- **Antes de escribir código, consultar con Context7** la versión actual y las firmas de Glance, Kotlin, el plugin del compilador de Compose y WorkManager. **[usuario, CLAUDE.md]**
- **Dependencias nuevas, justificadas:**
  - Plugin de Kotlin Android y plugin del compilador de Compose: Glance es Kotlin + Compose.
  - `androidx.glance:glance-appwidget`: los widgets.
  - `androidx.work:work-runtime-ktx`: mandar la cola de tildes cuando vuelve la red. Glance ya la trae como transitiva. Se declara solo si hace falta usar su API directamente.
  - Nada más. HTTP con `HttpURLConnection` y JSON con `org.json`, los dos de la plataforma. Sin Retrofit, sin Gson, sin `glance-material3`, porque los colores son fijos.
- La URL del servidor la guarda la web en `localStorage` del WebView, y Kotlin no puede leerla. La web se la tiene que pasar al nativo (ver 5.2).
- Zona horaria `America/Argentina/Buenos_Aires` para calcular "hoy". Semana desde el lunes. Textos en español (Argentina).
- Zonas táctiles de 48 dp como mínimo: checkbox, "+" y filas.

## 4. Experiencia

### 4.1 Estilo (los dos widgets) **[usuario: Hito C]**
- Fondo `#10131a` (`--bg`) con esquinas de 16 dp. Las filas van sobre ese fondo, sin tarjetas internas.
- Texto `#e6e9f0`. Texto secundario `#98a1b3`. Separadores `#2b3342`. Acento `#b7c4ff`.
- Colores de materia:
  - **pastel** = `materia.color`;
  - **fuerte** = el par de la paleta, que lo da el backend (ver 5.1);
  - sin materia = el `NEUTRAL` de la paleta.
- Fuente del sistema y tamaños de la escala del Hito C: título 15, fila 14.5, secundario 12.5.

### 4.2 Widget To-do **[usuario]**
- **Encabezado:** "To-do" y la cantidad de pendientes, por ejemplo "To-do · 7". A la derecha, el botón "+", que abre la app en `/todo/nueva`.
- **Lista:**
  - Una sola lista plana con scroll, sin secciones y **sin fechas a la vista**.
  - Muestra todas las tareas no completadas.
- **Orden por vencimiento:**
  1. Primero lo atrasado, después hoy, después lo que viene, por `dueDate`.
  2. En el mismo día, primero las que tienen hora, ordenadas por `dueTime`. Después las que no tienen hora, por `sortOrder`.
  3. Las tareas sin fecha van al final, por `sortOrder`.
- **Fila de 48 dp:** barra de 4 dp con el color pastel de la materia, checkbox y título en una línea (se corta con "…").
  - Las vencidas llevan el título en `#ffadad`.
  - Si el widget es angosto, la fila es la misma, solo que más corta.
- **Tildar:**
  - La tarea queda tachada y atenuada unos 3 segundos, y después desaparece.
  - Si la tocás de nuevo en ese rato, se destilda y se queda.
- **Tocar el título** abre la app en `/todo/:id`.
- **Lista vacía:** "Nada pendiente." y el "+".

### 4.3 Widget Agenda **[usuario]**
- **Encabezado:** "Agenda". Tocarlo abre la app en el calendario de hoy.
- **Rango:** de hoy a hoy + 7 días.
  - Un subtítulo por día, por ejemplo "Hoy · viernes 06/11", "Mañana · sábado 07/11" o "Lunes 09/11". **[mía]**
  - Los días sin nada no se muestran. **[mía]**
- **Contenido de cada día, en orden:**
  1. **Exámenes** (`parcial`, `recuperatorio`, `final`): fila con fondo sólido del tono fuerte de la materia y texto blanco, por ejemplo "Parcial · FIS · 09:00 · 2do parcial".
  2. **Otros eventos:** punto pastel, hora (o "Todo el día") y título.
  3. **Tareas de ese día:** iguales a las del widget To-do (barra, checkbox, título). Se tildan igual: tachadas unos 3 segundos y después desaparecen. **[usuario: se tildan; comportamiento igual al To-do, mía]**
- **Eventos de varios días:** aparecen en cada día del rango que cubren. **[mía]**
- **Vencidas:** no van en la Agenda, ya están en el widget To-do. **[mía]**
- **Tocar** un subtítulo, un evento o el título de una tarea abre la app en `/calendario?vista=mes&fecha=D&dia=D`, el detalle de ese día. **[usuario: "tocar abre la app en ese día"]**
- **Sin nada en los 8 días:** "Nada en los próximos 7 días."

### 4.4 Estados (los dos widgets) **[mía]**
- **Nunca se configuró el servidor:** "Abrí Study Workflow para conectar." Tocar abre la app.
- **Sin conexión, con datos guardados:** se muestra lo último que se guardó. Abajo del encabezado va una línea chica "Sin conexión · 06/11 14:30". Si hay tildes en cola, agrega "· 2 por sincronizar".
- **Sin conexión y sin datos:** "No pude cargar. Tocá para reintentar." Tocar fuerza un refresco.
- Nunca un widget en blanco ni el "No se puede cargar el widget" de Android: los errores se atajan en Kotlin.

### 4.5 Cuándo se refrescan **[usuario: al cambiar datos y periódicamente; mecanismos, mía]**
- **Cuando la app cambia datos:** después de cada escritura exitosa (POST, PATCH, PUT, DELETE), después de sincronizar la cola de la app y al pasar a segundo plano.
- **Periódicamente:** cada 30 minutos, el mínimo de Android para widgets. Eso además corrige "hoy" después de medianoche, con hasta 30 minutos de atraso.
- **Al tildar desde el widget:** se manda al toque y ese widget se redibuja. El otro widget también se redibuja, porque una tarea puede estar en los dos.

## 5. Cómo se arma (decisiones técnicas) **[mía salvo que se indique]**

### 5.1 Backend: color fuerte en materias
- `GET /api/materias` agrega `colorStrong` a cada materia, con `strongOf(color)` de `core/shared/palette.ts`.
- Así el widget no copia la paleta en Kotlin y hay una sola fuente de verdad.
- Es un campo nuevo que se agrega al final, así que la web no cambia.
- Un test de API verifica que el campo viene.

### 5.2 Puente web ↔ nativo: plugin `Widgets` (Java o Kotlin, en `android/`, mismo patrón que `SharedTextPlugin`)
- **`setServer({ url })`:** la web lo llama al guardar la URL y al arrancar en nativo. El nativo la guarda en sus `SharedPreferences`.
- **`refresh()`:** pide a los widgets que vuelvan a bajar datos y se redibujen.
  - La web lo llama donde dice la sección 4.5.
  - Se engancha en un solo lugar: `core/web/api.ts`, después de cada no-GET exitoso y después de `flush`. Más el evento de pasar a segundo plano. Los módulos no se enteran.
  - En la web (no nativo), estas llamadas no hacen nada.
- **Links desde el widget:**
  - Cada toque arma un `PendingIntent` a `MainActivity` con un extra `route`, por ejemplo `/todo/abc` o `/calendario?vista=mes&fecha=…&dia=…`.
  - `MainActivity` lo captura en `onCreate` y `onNewIntent`, igual que el texto compartido.
  - El plugin lo guarda hasta que la web lo pide (`takeRoute()`) o lo avisa con un evento `route` si la app ya estaba abierta.
  - La web navega con el router.
  - Si es la primera vez y falta la URL, la ruta espera a que se termine la pantalla Conectar, igual que hoy el texto compartido.
- `SharedTextPlugin` no se toca.

### 5.3 Datos en el widget
- **To-do:** `GET /api/todo` + `GET /api/materias`. Filtro y orden en Kotlin, según la sección 4.2.
- **Agenda:** `GET /api/calendar/agenda?from=hoy&to=hoy+7` + `GET /api/materias`. Agrupa por día los eventos (que ya vienen expandidos por la API, series incluidas) y los to-dos con `dueDate`. Las tareas completadas no se muestran.
- **Copia:**
  - La última respuesta buena de cada endpoint se guarda como texto JSON en `SharedPreferences`, con la hora.
  - Los dos widgets leen de ahí al dibujar y bajan datos nuevos en segundo plano.
  - Es lo mínimo que alcanza para un solo usuario. **[mía]**
- **Timeout:** 8 s, igual que la app.
- **Lógica pura en Kotlin:**
  - Una función `sortTodos(items, today)` y una función `agendaDays(agenda, today)`, sin Android adentro.
  - Llevan un test JUnit chico (orden de la lista y agrupado por día) y nada más. **[mía, siguiendo "menos tests"]**

### 5.4 Tildar y cola offline **[usuario: reusar la regla de la cola]**
- **Al tocar el checkbox:**
  1. Se marca en la copia local y se redibuja tachado.
  2. Se manda `PATCH /api/todo/:id { completed }`.
  3. A los ~3 s se redibuja sin la tarea, salvo que se haya destildado.
  4. La respuesta del PATCH actualiza la copia.
- **Si falla por red**, el tilde va a una cola nativa en `SharedPreferences`, con la misma forma y la misma regla que `core/web/offline.ts`:
  - `{ id, completed, baseUpdatedAt, at }`;
  - `baseUpdatedAt` es el `updatedAt` que tenía la tarea en la copia;
  - si hay varios tildes de la misma tarea, se colapsan en el último;
  - al mandar, primero `GET /api/todo/:id`: si el `updatedAt` del servidor es distinto de `baseUpdatedAt`, o si da 404, el tilde se descarta;
  - un 5xx o un error de red lo deja en la cola.
- **Cuándo se manda la cola:** con un trabajo de WorkManager con la condición "hay red", encolado cuando un tilde falla. También al principio de cada refresco.
- **Por qué hay dos colas** (la de la app y la del widget): Kotlin no puede leer el `localStorage` del WebView, y el widget tiene que sincronizar aunque la app nunca se abra.
  - Las dos usan la misma regla contra el mismo servidor, así que no se pisan.
  - *Límite conocido:* si tildás en el widget sin señal y abrís la app también sin señal, la app no ve ese tilde hasta que vuelva la red. Se anota en el código como `shortcut:`.
- **Test:** la decisión de "mandar o descartar" es una función pura y entra en el test JUnit de la sección 5.3.

### 5.5 Glance
- Un `GlanceAppWidget` y un `GlanceAppWidgetReceiver` por widget, más el `appwidget-provider` XML de cada uno.
  - Redimensionables en horizontal y vertical.
  - Tamaño inicial: To-do 4 × 3 y Agenda 4 × 4.
  - `updatePeriodMillis` de 30 minutos.
  - Vista previa en el selector de widgets: un layout simple con el nombre. **[mía]**
- **Componentes:**
  - Scroll con `LazyColumn`.
  - Checkbox con el componente de Glance y un callback de acción.
  - Los toques en filas, con `actionStartActivity` hacia `MainActivity` con el extra `route`.
  - El builder confirma con Context7 los nombres y firmas exactos de la versión actual.
- **Plan B del tachado [usuario]:** si Glance no permite la espera de 3 s de forma confiable, la tarea queda tachada hasta el próximo redibujo (tocarla de nuevo la destilda) y desaparece en el siguiente refresco. Se decide sin preguntar y se anota en el plan.
- **Tachado de 3 s:** el estado "tachado hasta" vive en la copia local, por ejemplo un mapa `id → hasta`, y se limpia al pasar el tiempo. El builder elige el mecanismo, por ejemplo `delay` en el callback y después `update`, y verifica que Glance permite esa espera.
- Nombres de los widgets en el selector: "Study Workflow · To-do" y "Study Workflow · Agenda".

## 6. Calidad
- **Tests:** uno de API (`colorStrong`) y un JUnit de lógica pura (orden, agrupado por día y la regla de la cola). Nada de tests de UI de Glance.
- **Verificación en la compu:** `npm test`, el build web y `npm run apk`, que compila los widgets.
- La prueba real la hace Federico en el S25 con la checklist de la sección 8.
- **Accesibilidad:** cada checkbox con `contentDescription` "Completar <título>" y el "+" con "Nueva tarea".
- **Docs:** `docs/android.md` suma "Agregar los widgets" (mantener apretada la pantalla de inicio → Widgets → Study Workflow). El README lo menciona en una línea.
- **Batería en Samsung [usuario]:** One UI puede frenar los refrescos periódicos y WorkManager. `docs/android.md` y la checklist explican cómo poner Study Workflow en batería "Sin restricciones" (Ajustes → Aplicaciones → Study Workflow → Batería).

## 7. Queda para el que construye
- Versiones exactas de Kotlin, Compose compiler y Glance compatibles con AGP 8.13. Se verifican con Context7.
- Si el plugin `Widgets` va en Java (como `SharedTextPlugin`) o en Kotlin.
- El mecanismo exacto del tachado de 3 s y del refresco desde el plugin (`updateAll`).
- Detalles de padding y del layout de la vista previa, dentro del estilo de la sección 4.1.
- Cómo partir el trabajo en tareas. Primero el backend y el puente web, que se verifican sin el celu. Después los widgets.

## 8. Al terminar
Frenar. Pasarle a Federico:
- el comando para compilar e instalar (`npm run apk` + `adb install -r`);
- la checklist de prueba en el S25:
  - agregar los dos widgets y redimensionarlos;
  - el orden del To-do;
  - tildar y destildar dentro de los 3 s;
  - tildar en modo avión y ver que se sincroniza al volver la red;
  - tildar desde la compu una tarea que estaba en cola y ver que gana la compu;
  - tocar una tarea → `/todo/:id`; tocar "+" → nueva tarea; tocar un día de la Agenda → detalle del día;
  - un examen se ve en tono fuerte;
  - cambiar algo en la app y ver que el widget se actualiza.
