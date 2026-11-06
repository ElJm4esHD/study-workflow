# Fase 3: widgets To-do y Agenda — Implementation Plan

> **For agentic workers:** Ejecutar con superpowers:executing-plans, **inline en esta sesión** (no subagent-driven). Una sola revisión al final de la fase. Steps con checkbox (`- [ ]`).

**Goal:** Dos widgets nativos (To-do y Agenda) en Jetpack Glance, interactivos (scroll y tildar), con caché y cola offline propias, que abren la app en la pantalla justa.

**Architecture:** El backend agrega `colorStrong` a las materias. La web le pasa al nativo la URL del servidor y le avisa cuando cambian datos, con un plugin Capacitor `Widgets`, y recibe de él la ruta a abrir. En Kotlin:
- una capa pura (`WidgetLogic.kt`, con test JUnit) ordena, agrupa y decide la cola;
- una capa Android (`WidgetStore`, `WidgetApi`, `SyncWorker`) guarda, baja datos y sincroniza;
- dos `GlanceAppWidget` dibujan desde la copia guardada.

**Tech Stack:** Kotlin, Jetpack Glance (`glance-appwidget`), WorkManager, `HttpURLConnection` + `org.json`. Capacitor 8 y AGP 8.13 ya existen.

**Spec:** `docs/superpowers/specs/2026-11-06-fase3-widgets-design.md`

## Global Constraints

- Ahorro de créditos: no releer archivos completos ya leídos. Context7 ya se consultó (abajo); no repetir consultas salvo que un build falle por una firma.
- Lo existente en Java (`MainActivity.java`, `SharedTextPlugin.java`) queda en Java. Todo lo nuevo de Android va en Kotlin, en `android/app/src/main/java/ar/federico/studyworkflow/widget/`.
- Dependencias nuevas: solo plugin Kotlin Android, plugin Compose compiler, `androidx.glance:glance-appwidget` y `androidx.work:work-runtime-ktx`. Nada más.
- `minSdkVersion` pasa de 24 a 26 en `android/variables.gradle`, para usar `java.time` sin desugaring. El S25 tiene Android 15.
- Zona horaria `America/Argentina/Buenos_Aires`. Fechas `YYYY-MM-DD` como String y horas `HH:MM`, que se comparan como texto.
- Colores del Hito C: bg `#10131a`, línea `#2b3342`, texto `#e6e9f0`, secundario `#98a1b3`, acento `#b7c4ff`, vencida `#ffadad`. Neutro sin materia: pastel `#b6bcc8` y fuerte `#5f6676`.
- Textos exactos:
  - "To-do · N", "Nada pendiente.", "Agenda", "Nada en los próximos 7 días.";
  - "Abrí Study Workflow para conectar.", "No pude cargar. Tocá para reintentar.";
  - "Sin conexión · dd/mm hh:mm", con el agregado " · N por sincronizar" cuando hay tildes en cola;
  - "Todo el día";
  - `contentDescription`: "Completar <título>" / "Destildar <título>", y "Nueva tarea" para el "+".
- Rutas de los links:
  - `/todo/nueva`;
  - `/todo/<id>`;
  - `/calendario?vista=mes&fecha=D&dia=D`;
  - para el encabezado de la Agenda, `/calendario?vista=mes&fecha=HOY&dia=HOY`.
- Timeout HTTP de 8 s. Zonas táctiles de 48 dp como mínimo.

### Lo que dijo Context7 (Glance, AGP)
- Receiver: `class X : GlanceAppWidgetReceiver() { override val glanceAppWidget = XWidget() }`. En el manifest va con `exported="false"`, `intent-filter APPWIDGET_UPDATE` y `meta-data android.appwidget.provider`.
- XML: `android:initialLayout="@layout/glance_default_loading_layout"`.
- Contenido: `override suspend fun provideGlance(context, id) { provideContent { … } }`.
- Acciones:
  - `actionRunCallback<T : ActionCallback>(actionParametersOf(key to v))`, con `suspend fun onAction(context, glanceId, parameters)`;
  - `actionStartActivity<MainActivity>(actionParametersOf(key to v))`. Los parámetros llegan como **extras del intent**, con el nombre de la key.
- Componentes: `CheckBox(checked, onCheckedChange = <Action>)` y `LazyColumn { items(list) { … } }`.
- Redibujar: `GlanceAppWidgetManager(ctx).getGlanceIds(X::class.java)`, después `updateAppWidgetState(ctx, id) { prefs -> … }` y `X().update(ctx, id)`. Son `suspend`.
- **El callback corre en un BroadcastReceiver async: lo largo va a un Worker.** Por eso el tachado de 3 s **no** se hace con `delay` en el callback, sino con un trabajo de WorkManager con `setInitialDelay(3 s)` (ver Task 5).
  - **Plan B [usuario]:** si en el S25 el trabajo demorado no corre a tiempo, la tarea queda tachada hasta el próximo redibujo (tocarla la destilda) y desaparece en el siguiente refresco. Es el mismo código: no se borra nada, solo se acepta la demora.
- Kotlin ≥ 2.0: Compose compiler plugin con la **misma versión** que Kotlin. Con Kotlin ≥ 2.2 no hace falta `kotlinOptions.jvmTarget`.
  - Capacitor compila con Java 21. Si el build se queja de *JVM target*, agregar `kotlin { compilerOptions { jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21 } }`.

## Review Focus

1. **Sin URL configurada** (widget agregado antes de abrir la app): tiene que mostrar "Abrí Study Workflow para conectar.", nunca "No se puede cargar el widget". Toda excepción en `provideGlance` y en el Worker se ataja.
2. **Dos toques rápidos en la misma tarea** (tildar y destildar en < 3 s): la cola se colapsa en el último, la tarea se queda y el servidor termina en `completed=false`. Lo cubre el test `enqueueOp colapsa`.
3. **Tilde en cola + cambio desde la compu:** se descarta el tilde. Lo cubre el test `shouldSend`.
4. **Medianoche:** "hoy" se recalcula en cada dibujo con `ZoneId` AR, no se guarda.
5. **Evento de varios días y serie recurrente en la Agenda:** aparece en cada día que cubre, dentro del rango. Lo cubre el test `agendaDays`.

---

### Task 1: `colorStrong` en materias (backend)

**Files:**
- Modify: `core/server/registry.ts:4` (tipo `Materia`)
- Modify: `core/server/materias.ts:10-12` (`toMateria`)
- Test: `core/server/materias.test.ts`

- [ ] **Step 1: Test que falla.** En `materias.test.ts`, agregar:
```ts
test('materias incluyen colorStrong del par de la paleta', async () => {
  const app = await makeTestApp();
  await app.inject({ method: 'POST', url: '/api/materias', payload: { name: 'Física', color: PALETTE[0]!.hex } });
  const [m] = (await app.inject('/api/materias')).json();
  expect(m.colorStrong).toBe(PALETTE[0]!.strong);
});
```
Copiar cómo los tests existentes del archivo crean la app (`makeTestApp`) y ajustar si la firma difiere.
- [ ] **Step 2:** `npx vitest run core/server/materias.test.ts` → FAIL (`colorStrong` undefined).
- [ ] **Step 3:**
  - `Materia` suma `colorStrong: string`.
  - `toMateria` suma `colorStrong: strongOf(r.color)`, importado de `../shared/palette.ts`.
  - Si `tsc` marca otros lugares que construyen `Materia` a mano (tests, fixtures, web), agregarles el campo.
- [ ] **Step 4:** `npm test` → todo PASS. `npx tsc -b` (o el script de typecheck del `package.json`) sin errores.
- [ ] **Step 5:** commit `feat: colorStrong en materias para los widgets`.

### Task 2: puente web → widgets

**Files:**
- Create: `core/web/widgets.ts`
- Modify: `core/web/server.ts` (`setServerUrl`)
- Modify: `core/web/api.ts` (`api`, `resync`)
- Modify: `core/web/App.tsx` (`Routes` useEffect, `App`)
- Modify: `core/web/CoreContext.tsx:48` (visibilitychange)

**Interfaces:**
- Produces (`core/web/widgets.ts`):
  - `setWidgetServer(url: string | null): void`;
  - `refreshWidgets(): void`;
  - `takeWidgetRoute(): Promise<string | null>`;
  - `onWidgetRoute(fn: (route: string) => void): () => void`.
- Todas son no-op en la web. Usar `Capacitor.isNativePlatform()` directo, **sin importar `server.ts`**, para no crear un import circular.
- Plugin nativo `Widgets` (lo crea la Task 4): `setServer({ url })`, `refresh()`, `takeRoute(): { route: string | null }` y el evento `'route'` con `{ route }`.

- [ ] **Step 1:** escribir `widgets.ts` con el mismo patrón que `core/web/shared.ts`: `registerPlugin('Widgets')` solo si es nativo. Las llamadas son `void plugin?.x().catch(() => {})`: un fallo del widget nunca rompe la app.
- [ ] **Step 2:** enganches:
  - `server.ts` → `setServerUrl` llama a `setWidgetServer(url)`.
  - `App.tsx` → en `App`, un `useEffect` sin deps llama a `setWidgetServer(getServerUrl())`, para las instalaciones que ya estaban configuradas.
  - `App.tsx` → en `Routes`, un segundo `useEffect` igual al del texto compartido: `takeWidgetRoute().then(r => r && router.navigate(r))` y `return onWidgetRoute(r => router.navigate(r))`.
  - `api.ts` → en `api()`, justo antes de `return r.json as T`: `if (method !== 'GET') refreshWidgets();`.
  - `api.ts` → en `resync()`, después de `flush`: `if (f.sent > 0) refreshWidgets();`.
  - `CoreContext.tsx` → en el handler `vis`, agregar `if (document.visibilityState === 'hidden') refreshWidgets();`.
- [ ] **Step 3:** `npm test` y `npm run build` → PASS. Sin test nuevo: son llamadas no-op en la web.
- [ ] **Step 4:** commit `feat: puente de la web con los widgets`.

### Task 3: Kotlin en el proyecto + lógica pura con test

**Files:**
- Modify: `android/build.gradle` (classpath de Kotlin y del plugin Compose)
- Modify: `android/app/build.gradle` (plugins, `buildFeatures { compose true }`, dependencias)
- Modify: `android/variables.gradle` (`minSdkVersion = 26`)
- Create: `android/app/src/main/java/ar/federico/studyworkflow/widget/WidgetLogic.kt`
- Test: `android/app/src/test/java/ar/federico/studyworkflow/widget/WidgetLogicTest.kt`

**Versiones:**
- Kotlin `2.2.21`, tanto `org.jetbrains.kotlin:kotlin-gradle-plugin` como `org.jetbrains.kotlin:compose-compiler-gradle-plugin`. Si no resuelve, usar la 2.2.x más alta que resuelva, la misma en los dos.
- `androidx.glance:glance-appwidget:1.1.1`. Si existe una estable más nueva, usar esa.
- `androidx.work:work-runtime-ktx:2.10.1`.
- `apply plugin: 'kotlin-android'` y `apply plugin: 'org.jetbrains.kotlin.plugin.compose'` después de `com.android.application`.

**Interfaces (Produces, `WidgetLogic.kt`; sin imports de Android):**
```kotlin
data class Todo(val id: String, val title: String, val dueDate: String?, val dueTime: String?,
                val materiaId: String?, val completed: Boolean, val sortOrder: Int, val updatedAt: String)
data class Ev(val id: String, val title: String, val kind: String, val allDay: Boolean,
              val startDate: String, val endDate: String, val startTime: String?, val materiaId: String?)
data class Mat(val id: String, val sigla: String, val color: String, val colorStrong: String)
data class Day(val date: String, val exams: List<Ev>, val events: List<Ev>, val todos: List<Todo>)
data class QueueOp(val id: String, val completed: Boolean, val baseUpdatedAt: String?, val at: String)

val EXAM_KINDS = setOf("parcial", "recuperatorio", "final")
fun todoList(items: List<Todo>, keep: Set<String>): List<Todo>
fun isOverdue(t: Todo, today: String): Boolean           // dueDate != null && dueDate < today
fun agendaDays(events: List<Ev>, todos: List<Todo>, today: String, keep: Set<String>): List<Day>
fun dayLabel(date: String, today: String): String
fun enqueueOp(queue: List<QueueOp>, op: QueueOp): List<QueueOp>
fun shouldSend(op: QueueOp, status: Int, serverUpdatedAt: String?): Boolean
```

**Reglas:**
- `todoList`:
  - incluye lo no completado y lo completado cuyo id está en `keep` (tachadas de 3 s);
  - ordena por `dueDate` (las null al final); en el mismo día, primero las que tienen `dueTime`, por hora, y después por `sortOrder`;
  - las sin fecha, por `sortOrder`.
- `agendaDays`:
  - cubre de `today` a `today + 7`;
  - un evento entra en cada día de `max(startDate, today)..min(endDate, today+7)`;
  - en cada día, `exams` (kind ∈ `EXAM_KINDS`) y `events` van ordenados por `allDay` primero y después por `startTime`;
  - `todos` son las de ese `dueDate`, con el mismo criterio de visibilidad y orden que `todoList`;
  - los días vacíos se omiten.
- `dayLabel`:
  - para hoy, `"Hoy · viernes 06/11"`;
  - para mañana, `"Mañana · sábado 07/11"`;
  - para el resto, `"Lunes 09/11"`;
  - días en español con `java.time` + `Locale("es", "AR")`, la primera letra en mayúscula solo cuando va al principio.
- `enqueueOp`: si ya hay un op con ese id, se reemplaza en su lugar conservando el `baseUpdatedAt` del primero. Si no, se agrega al final.
- `shouldSend`: es la regla de `core/web/offline.ts` → `flush`.
  - Devuelve `false` si `status == 404`, si `serverUpdatedAt == null`, o si `(base == null ? serverUpdatedAt >= op.at : serverUpdatedAt != base)`.
  - Si no, devuelve `true`.
  - Otros status (5xx) no llegan acá: el caller corta antes.

- [ ] **Step 1: Test que falla** (`WidgetLogicTest.kt`, JUnit 4, ya está `testImplementation junit`). Cuatro tests:
  - `todoList_ordena`: vencida 2026-11-03, hoy 06 con hora 10:00, hoy 06 sin hora (sortOrder 1), hoy 06 sin hora (sortOrder 0), futura 2026-11-10, sin fecha y una completada fuera de `keep`. Con keep vacío el orden esperado de ids es `[venc, h10, s0, s1, fut, nofecha]`, y la completada no aparece. Con `keep = {completada}`, aparece.
  - `agendaDays_agrupa`: today `2026-11-06`. Un evento de varios días 05→07, un parcial 09 y una tarea 06. Días esperados: `06` (evento + tarea), `07` (evento) y `09` (parcial en `exams`). `08` se omite.
  - `enqueueOp_colapsa`: op1 (`id a`, `true`, base `"u1"`) + op2 (`id a`, `false`, base `"u2"`) → una sola op, `completed=false`, base `"u1"`.
  - `shouldSend_regla`: `(404, "x") → false`; base `"u1"` y server `"u1"` → `true`; base `"u1"` y server `"u2"` → `false`; base null, `at "2026-11-06T10:00:00Z"` y server `"2026-11-06T09:00:00Z"` → `true`.
  - Además, un assert de `dayLabel("2026-11-06", "2026-11-06") == "Hoy · viernes 06/11"`.
- [ ] **Step 2:** en `android/`, correr `.\gradlew.bat testReleaseUnitTest --tests "*WidgetLogicTest*"` → FAIL (no compila). Usar el JDK que encuentra `scripts/apk.mjs`: si `JAVA_HOME` no está, setear `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"` en esa terminal.
- [ ] **Step 3:** implementar `WidgetLogic.kt`.
- [ ] **Step 4:** el mismo comando → PASS. Después `npm run apk` → compila. El APK todavía no tiene widgets: esto solo prueba que Kotlin y Compose están bien configurados.
- [ ] **Step 5:** commit `feat: Kotlin + lógica pura de los widgets con test`.

### Task 4: datos, sincronización y plugin `Widgets`

**Files (todos en `.../studyworkflow/widget/`, salvo `MainActivity`):**
- Create: `WidgetStore.kt`
- Create: `WidgetApi.kt`
- Create: `SyncWorker.kt`
- Create: `WidgetsPlugin.kt`
- Create: `Redraw.kt`
- Modify: `.../studyworkflow/MainActivity.java`

**Interfaces (Produces):**
```kotlin
object WidgetStore {          // SharedPreferences "sw_widgets"
  fun server(ctx: Context): String?;            fun setServer(ctx: Context, url: String?)
  fun todos(ctx: Context): List<Todo>?;         fun mats(ctx: Context): Map<String, Mat>
  fun agenda(ctx: Context): Pair<List<Ev>, List<Todo>>?   // de la última agenda guardada
  fun savedAt(ctx: Context): Long?              // ms de la última sync buena
  fun offline(ctx: Context): Boolean;           fun setOffline(ctx: Context, v: Boolean)
  fun queue(ctx: Context): List<QueueOp>;       fun setQueue(ctx: Context, q: List<QueueOp>)
  fun keep(ctx: Context): Set<String>           // ids con "tachado hasta" > ahora
  fun nextKeepExpiry(ctx: Context): Long?
  fun toggle(ctx: Context, id: String, completed: Boolean)   // ver abajo
  fun saveAll(ctx: Context, todoJson: String, agendaJson: String, matsJson: String)
  fun setUpdatedAt(ctx: Context, id: String, updatedAt: String)
}
object WidgetApi {            // HttpURLConnection, timeouts de 8000 ms, Accept JSON
  class Http(val status: Int, val body: String)
  fun get(base: String, path: String): Http             // tira IOException si no hay red
  fun patchCompleted(base: String, id: String, completed: Boolean): Http
}
class SyncWorker : CoroutineWorker { companion object {
  fun schedule(ctx: Context, delayMs: Long = 0)   // enqueueUniqueWork("sw-sync", REPLACE)
  fun scheduleOnNetwork(ctx: Context)             // enqueueUniqueWork("sw-sync-net", KEEP, NetworkType.CONNECTED)
} }
suspend fun redrawAll(ctx: Context)   // Redraw.kt: sube REV en el estado de cada instancia de los dos widgets y llama update
val REV = longPreferencesKey("rev")   // Redraw.kt
```

**Comportamiento:**
- **Parseo:** `org.json` dentro de `WidgetStore`, de los JSON guardados tal cual vienen de la API:
  - `/api/todo` es un array de `TodoItem`;
  - `/api/calendar/agenda` es `{ events, todos }`;
  - `/api/materias` es un array con `colorStrong`.
  - Campos null con `optString(...).takeIf { !isNull(k) }` o equivalente.
- **`toggle`**, en orden:
  1. Arma `QueueOp(id, completed, baseUpdatedAt = updatedAt del ítem en la copia, at = Instant.now().toString())` y lo pasa por `enqueueOp`.
  2. Cambia `completed` de ese id en los JSON guardados de todo y agenda.
  3. Si `completed`, `keep[id] = now + 3000`. Si no, saca el id de `keep`.
- **`SyncWorker.doWork`**, todo dentro de `try`, nunca lanza:
  1. Si `server == null`, `redrawAll` y `success`.
  2. **Flush:** por cada op de la cola, en orden:
     - `GET /api/todo/:id`. Si da IOException o un status que no es 200 ni 404, corta.
     - Si `shouldSend` da true, `PATCH`. Si el PATCH da 2xx, `setUpdatedAt` con la respuesta. Si da 5xx o IOException, corta.
     - Si no corta, saca el op de la cola, **solo si su `at` no cambió**: si el usuario volvió a tocar mientras tanto, el op nuevo se queda.
  3. **Fetch:** `today` = `LocalDate.now(ZoneId.of("America/Argentina/Buenos_Aires"))`.
     - Pide `/api/todo`, `/api/calendar/agenda?from=today&to=today+7` y `/api/materias`.
     - Si las tres dan 200, `saveAll` y `setOffline(false)`.
     - Si alguna da IOException, `setOffline(true)`.
  4. Si quedó cola o hubo IOException, `scheduleOnNetwork`.
  5. `redrawAll`.
  6. Si `nextKeepExpiry` existe, `schedule(delay = expiry - now + 100)`. Así desaparecen las tachadas aunque un refresh haya reemplazado el trabajo demorado.
- **`WidgetsPlugin`** (`@CapacitorPlugin(name = "Widgets")`, en Kotlin):
  - `setServer(call)` → `WidgetStore.setServer` y `SyncWorker.schedule`.
  - `refresh(call)` → `SyncWorker.schedule`.
  - `takeRoute(call)` → devuelve y limpia la ruta pendiente.
  - En el companion: `@JvmStatic fun capture(intent: Intent?): Boolean`, que lee el extra `"sw_route"`; y `fun deliver()`, que hace `notifyListeners("route", { route })`.
  - Mismo patrón que `SharedTextPlugin.java`, con la ruta pendiente en un campo estático.
- **`MainActivity.java`:**
  - `registerPlugin(WidgetsPlugin.class)`;
  - en `onCreate`, `WidgetsPlugin.capture(getIntent())`;
  - en `onNewIntent`, si `capture` da true y el plugin está cargado, llamar a `deliver()` igual que hoy con `SharedText`.
- Un comentario `shortcut:` en `SyncWorker` dice: "la cola del widget y la de la app son independientes; un tilde offline del widget no se ve en la app offline hasta que vuelva la red".

- [ ] **Step 1:** implementar los cinco archivos y el cambio en `MainActivity`.
- [ ] **Step 2:** `npm run apk` → compila. Sin tests nuevos: la regla de la cola ya está probada en la Task 3, y esto es pegamento con Android.
- [ ] **Step 3:** commit `feat: datos, cola offline y plugin de los widgets`.

### Task 5: widgets Glance (UI, acciones, manifest)

**Files (en `.../widget/` y `res/`):**
- Create: `WidgetUi.kt`: colores, `Header`, `StatusLine`, `TaskRow`, `EmptyState`.
- Create: `TodoWidget.kt`: `TodoWidget : GlanceAppWidget` + `TodoWidgetReceiver`.
- Create: `AgendaWidget.kt`: `AgendaWidget` + `AgendaWidgetReceiver`.
- Create: `ToggleAction.kt`: `ActionCallback`.
- Create: `res/xml/widget_todo_info.xml` y `res/xml/widget_agenda_info.xml`.
- Modify: `res/values/strings.xml`: `widget_todo_name` "Study Workflow · To-do" y `widget_agenda_name` "Study Workflow · Agenda".
- Modify: `AndroidManifest.xml`: los dos `<receiver>` y `<receiver androidx.work…>` solo si el build lo pide.

**Interfaces:**
- Consumes: todo lo de las Tasks 3 y 4.
- `ToggleAction` lee los params `idKey = ActionParameters.Key<String>("id")` y `doneKey = ActionParameters.Key<Boolean>("done")`, y hace `WidgetStore.toggle`, `redrawAll` y `SyncWorker.schedule(ctx, 3000)`.

**Detalles:**
- **Contenido:**
  - `provideGlance` → `provideContent { val rev = currentState(REV); Content(rev) }`.
  - `Content` lee `WidgetStore` con `LocalContext.current` dentro de `remember(rev)`.
  - Calcula `today` en cada composición.
  - Envuelve la lectura en `runCatching`: si falla, muestra "No pude cargar. Tocá para reintentar.".
- **Estados (4.4 del spec):**
  - si `server == null`, el texto de conectar, que al tocarlo abre `MainActivity` sin ruta;
  - si no hay datos, el reintentar, que al tocarlo corre `actionRunCallback<RefreshAction>`. `RefreshAction` va en `ToggleAction.kt` y llama a `SyncWorker.schedule`;
  - si `offline`, la `StatusLine` con `savedAt` formateado `dd/MM HH:mm` y "· N por sincronizar" si la cola no está vacía.
- **`TaskRow(t: Todo, mat: Mat?, overdue: Boolean, tapRoute: String)`:**
  - fila de 48 dp;
  - `Box` de 4 dp de ancho con el pastel de la materia, o `#b6bcc8` si no tiene;
  - `CheckBox(checked = t.completed, onCheckedChange = actionRunCallback<ToggleAction>(id, !t.completed))`, con colores del acento, y `contentDescription` según los Global Constraints;
  - título en una línea, 14.5 sp, `#ffadad` si está vencida, tachado (`TextDecoration.LineThrough`) y en `#98a1b3` si `completed`;
  - el título es `clickable(actionStartActivity<MainActivity>(actionParametersOf(routeKey to tapRoute)))`, con `routeKey = ActionParameters.Key<String>("sw_route")`.
- **To-do:**
  - `Header("To-do · N")`, donde N son las pendientes no completadas;
  - "+" de 48 dp → ruta `/todo/nueva`;
  - `LazyColumn` de `todoList(...)`, con `tapRoute = "/todo/<id>"`.
- **Agenda:**
  - `Header("Agenda")` clickeable a la ruta de hoy;
  - `LazyColumn` que por cada `Day` pone un subtítulo con `dayLabel`, 12.5 sp, `#98a1b3`, clickeable al día;
  - **exámenes:** fila con fondo `colorStrong` (o `#5f6676`), texto blanco `"<Tipo> · <SIGLA> · <hora> · <título>"`. Tipo con mayúscula inicial. Sin hora si `allDay`;
  - **eventos:** punto pastel de 8 dp, hora o "Todo el día", y título;
  - **tareas:** `TaskRow` con `tapRoute` al día;
  - todo lo del día abre `/calendario?vista=mes&fecha=D&dia=D`.
- **Fondo:** `GlanceModifier.fillMaxSize().background(#10131a).cornerRadius(16.dp).padding(…)`.
- **XML de cada widget:**
  - `initialLayout="@layout/glance_default_loading_layout"`;
  - `resizeMode="horizontal|vertical"`, `updatePeriodMillis="1800000"`, `widgetCategory="home_screen"`;
  - `targetCellWidth="4"`, con `targetCellHeight` 3 en To-do y 4 en Agenda;
  - `minWidth="180dp"`, `minHeight="110dp"`;
  - `android:description` con el nombre;
  - sin `previewLayout`: Android muestra el ícono. Esto reemplaza la vista previa simple del spec, que no aporta.
- **Receivers:** `override fun onUpdate(...)` llama a `super` y después a `SyncWorker.schedule(context)`. Así el periódico de 30 min baja datos. No hay bucle, porque `redrawAll` usa `update()` y no un broadcast.

- [ ] **Step 1:** implementar los archivos, el manifest y los strings.
- [ ] **Step 2:** `npm run apk` → compila, y `.\gradlew.bat testReleaseUnitTest` sigue en PASS.
- [ ] **Step 3:** si hay un celu por adb (`adb devices`), instalar con `adb install -r dist\study-workflow.apk`, agregar los widgets y verificar que dibujan sin "No se puede cargar el widget". Si no hay celu, anotar "sin verificar en dispositivo" y seguir.
- [ ] **Step 4:** commit `feat: widgets To-do y Agenda en Glance`.

### Task 6: docs + revisión final

**Files:**
- Modify: `docs/android.md`: sección nueva "Widgets", antes de "Actualizar".
- Modify: `README.md`: una línea en la parte del APK, "Widgets: ver docs/android.md".

- [ ] **Step 1:** la sección de `docs/android.md` dice:
  - **Agregar:** mantener apretada la pantalla de inicio → **Widgets** → **Study Workflow** → arrastrar "To-do" o "Agenda". Para redimensionarlo, mantenerlo apretado y tirar de los bordes.
  - **Antes:** abrir la app una vez con conexión, porque si no el widget dice "Abrí Study Workflow para conectar.".
  - **Batería [usuario]:** **Ajustes → Aplicaciones → Study Workflow → Batería → Sin restricciones**. Sin esto, One UI puede frenar los refrescos y la sincronización de tildes hechos sin señal.
  - **Cuándo se actualizan:** al cambiar algo en la app, al salir de la app, al tildar y cada 30 min.
  - **Problemas:** si un tilde sin señal no se sube, revisar la batería "Sin restricciones" y abrir la app una vez.
- [ ] **Step 2:** una sola revisión final de toda la fase (`git diff <commit del diseño>..HEAD`), hecha por un reviewer con modelo sonnet. Corregir lo que encuentre, `npm test`, `npm run apk`.
- [ ] **Step 3:** commit `docs: widgets en la guía de Android`.
- [ ] **Step 4: FRENAR** y pasarle a Federico solo esta checklist:

**Checklist en el S25**
1. Instalar: `npm run apk` y `& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r dist\study-workflow.apk`. Abrir la app una vez con Tailscale prendido.
2. Ajustes → Aplicaciones → Study Workflow → Batería → **Sin restricciones**.
3. Agregar los widgets To-do y Agenda y redimensionarlos: tienen que verse bien angostos y altos.
4. **To-do:**
   - el orden es vencidas (en rojo suave), hoy (primero las que tienen hora), próximas y sin fecha;
   - no se ven fechas;
   - el scroll anda.
5. Tildar una tarea: queda tachada unos 3 s y desaparece. Tildar otra y tocarla de nuevo antes de 3 s: se destilda y se queda. En la app, las dos quedan como corresponde.
6. **Agenda:**
   - hay títulos "Hoy · …" y "Mañana · …", y no aparecen los días vacíos;
   - un parcial aparece en el tono fuerte;
   - tildar una tarea desde la Agenda anda.
7. **Links:**
   - tocar una tarea del To-do abre `/todo/:id`;
   - el "+" abre "nueva tarea";
   - tocar un día o un evento de la Agenda abre el detalle de ese día;
   - todo eso anda con la app cerrada y con la app abierta.
8. **Modo avión:**
   - tildar en el widget: aparece "Sin conexión · … · 1 por sincronizar";
   - sacar el modo avión: en menos de 1 minuto se sube solo y el aviso desaparece.
9. **Gana la compu:** en modo avión tildar la tarea X en el widget. En la compu, editar el título de X. Sacar el modo avión: X sigue sin tildar en el servidor.
10. Cambiar algo en la app (crear una tarea) y salir: el widget se actualiza.
11. Apagar Tailscale: los widgets siguen mostrando lo último y dicen "Sin conexión · …". Ninguno muestra "No se puede cargar el widget".
