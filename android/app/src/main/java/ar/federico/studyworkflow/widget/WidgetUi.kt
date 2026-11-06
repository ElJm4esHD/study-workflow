package ar.federico.studyworkflow.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.action.Action
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.CheckBox
import androidx.glance.appwidget.CheckboxDefaults
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextDecoration
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import ar.federico.studyworkflow.MainActivity
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Colores del Hito C (tema oscuro fijo). */
object Pal {
    val bg = Color(0xFF10131A)
    val text = Color(0xFFE6E9F0)
    val muted = Color(0xFF98A1B3)
    val accent = Color(0xFFB7C4FF)
    val onAccent = Color(0xFF141A33)
    val overdue = Color(0xFFFFADAD)
    val neutral = Color(0xFFB6BCC8)
    val neutralStrong = Color(0xFF5F6676)
}

val routeKey = ActionParameters.Key<String>(WidgetsPlugin.EXTRA_ROUTE)
val idKey = ActionParameters.Key<String>("id")
val doneKey = ActionParameters.Key<Boolean>("done")

private val AR = ZoneId.of("America/Argentina/Buenos_Aires")

fun hex(s: String?, fallback: Color): Color = runCatching { Color(android.graphics.Color.parseColor(s)) }.getOrDefault(fallback)
fun dayRoute(d: String) = "/calendario?vista=mes&fecha=$d&dia=$d"

/** Todo lo que un widget necesita para dibujar, leído de la copia local. */
class Snap(
    val server: String?, val todos: List<Todo>?, val events: List<Ev>?, val agendaTodos: List<Todo>?,
    val mats: Map<String, Mat>, val offline: Boolean, val savedAt: Long?, val queued: Int, val keep: Set<String>, val today: String,
)

/** null si algo falla al leer: el widget muestra "No pude cargar" en vez de romperse. */
fun snapshot(ctx: Context): Snap? = runCatching {
    val agenda = WidgetStore.agenda(ctx)
    Snap(
        WidgetStore.server(ctx), WidgetStore.todos(ctx), agenda?.first, agenda?.second, WidgetStore.mats(ctx),
        WidgetStore.offline(ctx), WidgetStore.savedAt(ctx), WidgetStore.queue(ctx).size, WidgetStore.keep(ctx),
        LocalDate.now(AR).toString(),
    )
}.getOrNull()

@Composable
fun openApp(route: String?): Action =
    actionStartActivity<MainActivity>(if (route == null) actionParametersOf() else actionParametersOf(routeKey to route))

@Composable
fun Root(content: @Composable () -> Unit) {
    Column(GlanceModifier.fillMaxSize().appWidgetBackground().background(Pal.bg).cornerRadius(16.dp).padding(8.dp)) { content() }
}

@Composable
fun Message(text: String, onClick: Action) {
    Box(GlanceModifier.fillMaxSize().clickable(onClick), contentAlignment = Alignment.Center) {
        Text(text, style = TextStyle(color = ColorProvider(Pal.muted), fontSize = 13.sp))
    }
}

@Composable
fun Header(title: String, route: String?, plusRoute: String? = null) {
    Row(GlanceModifier.fillMaxWidth().height(48.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            title, maxLines = 1,
            style = TextStyle(color = ColorProvider(Pal.text), fontSize = 15.sp, fontWeight = FontWeight.Bold),
            modifier = GlanceModifier.defaultWeight().padding(start = 4.dp).clickable(openApp(route)),
        )
        if (plusRoute != null) {
            Box(
                GlanceModifier.size(48.dp).clickable(openApp(plusRoute)).semantics { contentDescription = "Nueva tarea" },
                contentAlignment = Alignment.Center,
            ) { Text("+", style = TextStyle(color = ColorProvider(Pal.accent), fontSize = 24.sp, fontWeight = FontWeight.Bold)) }
        }
    }
}

@Composable
fun StatusLine(s: Snap) {
    if (!s.offline) return
    val at = s.savedAt?.let { " · " + DateTimeFormatter.ofPattern("dd/MM HH:mm").format(Instant.ofEpochMilli(it).atZone(AR)) } ?: ""
    val q = if (s.queued > 0) " · ${s.queued} por sincronizar" else ""
    Text("Sin conexión$at$q", style = TextStyle(color = ColorProvider(Pal.muted), fontSize = 12.sp), modifier = GlanceModifier.padding(start = 4.dp))
}

@Composable
fun TaskRow(t: Todo, mat: Mat?, overdue: Boolean, route: String) {
    Row(GlanceModifier.fillMaxWidth().height(48.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(GlanceModifier.width(4.dp).height(28.dp).background(hex(mat?.color, Pal.neutral))) {}
        CheckBox(
            checked = t.completed,
            onCheckedChange = actionRunCallback<ToggleAction>(actionParametersOf(idKey to t.id, doneKey to !t.completed)),
            modifier = GlanceModifier.semantics { contentDescription = (if (t.completed) "Destildar " else "Completar ") + t.title },
            colors = CheckboxDefaults.colors(checkedColor = ColorProvider(Pal.accent), uncheckedColor = ColorProvider(Pal.muted)),
        )
        Text(
            t.title, maxLines = 1,
            style = TextStyle(
                color = ColorProvider(if (t.completed) Pal.muted else if (overdue) Pal.overdue else Pal.text),
                fontSize = 14.5.sp,
                textDecoration = if (t.completed) TextDecoration.LineThrough else TextDecoration.None,
            ),
            modifier = GlanceModifier.defaultWeight().clickable(openApp(route)),
        )
    }
}
