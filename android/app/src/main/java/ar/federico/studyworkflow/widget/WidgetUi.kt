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
import androidx.glance.ColorFilter
import androidx.glance.Image
import androidx.glance.ImageProvider
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
import androidx.glance.LocalContext
import androidx.glance.text.TextDecoration
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.color.ColorProvider as DayNight
import ar.federico.studyworkflow.MainActivity
import ar.federico.studyworkflow.R
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Tokens de core/web/styles.css en oscuro y claro. Root fija el tema elegido en la app ("system" sigue al celu en vivo). */
object Pal {
    var mode = "dark"
    fun pick(dark: Color, light: Color): ColorProvider = when (mode) {
        "light" -> ColorProvider(light)
        "system" -> DayNight(day = light, night = dark)
        else -> ColorProvider(dark)
    }
    private fun c(dark: Long, light: Long) = pick(Color(dark), Color(light))
    val bg get() = c(0xFF0E1117, 0xFFF4F5F8)
    val surface get() = c(0xFF161B24, 0xFFFFFFFF)
    val surface2 get() = c(0xFF1D2430, 0xFFEEF0F5)
    val text get() = c(0xFFE8EBF2, 0xFF171C27)
    val muted get() = c(0xFFA3ACBE, 0xFF4F586A)
    val faint get() = c(0xFF8790A4, 0xFF646D80)
    val onAccent get() = c(0xFF141A33, 0xFFFFFFFF)
    val overdue get() = c(0xFFFFA3A3, 0xFFC22F2F)
    /** Color de materia: el pastel en oscuro, el tono fuerte en claro (contraste AA sobre blanco). */
    fun mat(m: Mat?) = pick(hex(m?.color, Color(0xFFB6BCC8)), hex(m?.colorStrong, Color(0xFF5F6676)))
}

val routeKey = ActionParameters.Key<String>(WidgetsPlugin.EXTRA_ROUTE)
val idKey = ActionParameters.Key<String>("id")
val doneKey = ActionParameters.Key<Boolean>("done")

private val AR = ZoneId.of("America/Argentina/Buenos_Aires")

fun hex(s: String?, fallback: Color): Color = runCatching { Color(android.graphics.Color.parseColor(s)) }.getOrDefault(fallback)

/** Todo lo que un widget necesita para dibujar, leído de la copia local. */
class Snap(
    val server: String?, val todos: List<Todo>?,
    val mats: Map<String, Mat>, val offline: Boolean, val savedAt: Long?, val queued: Int, val keep: Set<String>, val today: String,
)

/** null si algo falla al leer: el widget muestra "No pude cargar" en vez de romperse. */
fun snapshot(ctx: Context): Snap? = runCatching {
    Snap(
        WidgetStore.server(ctx), WidgetStore.todos(ctx), WidgetStore.mats(ctx),
        WidgetStore.offline(ctx), WidgetStore.savedAt(ctx), WidgetStore.queue(ctx).size, WidgetStore.keep(ctx),
        LocalDate.now(AR).toString(),
    )
}.getOrNull()

@Composable
fun openApp(route: String?): Action =
    actionStartActivity<MainActivity>(if (route == null) actionParametersOf() else actionParametersOf(routeKey to route))

@Composable
fun Root(content: @Composable () -> Unit) {
    Pal.mode = WidgetStore.theme(LocalContext.current)
    Column(GlanceModifier.fillMaxSize().appWidgetBackground().background(Pal.bg).cornerRadius(24.dp).padding(horizontal = 6.dp, vertical = 4.dp)) { content() }
}

@Composable
fun Message(text: String, onClick: Action) {
    Box(GlanceModifier.fillMaxSize().clickable(onClick), contentAlignment = Alignment.Center) {
        Text(text, style = TextStyle(color = Pal.muted, fontSize = 13.sp))
    }
}

@Composable
fun Header(title: String, count: Int, route: String?, plusRoute: String? = null) {
    val ctx = LocalContext.current
    val accent = Pal.pick(Color(WidgetStore.accent(ctx)), Color(WidgetStore.accentLight(ctx)))
    Row(GlanceModifier.fillMaxWidth().height(48.dp), verticalAlignment = Alignment.CenterVertically) {
        Row(GlanceModifier.defaultWeight().padding(start = 8.dp).clickable(openApp(route)), verticalAlignment = Alignment.CenterVertically) {
            Text(title, maxLines = 1, style = TextStyle(color = Pal.text, fontSize = 16.sp, fontWeight = FontWeight.Bold))
            if (count > 0) Text(
                "$count", style = TextStyle(color = accent, fontSize = 12.sp, fontWeight = FontWeight.Bold),
                modifier = GlanceModifier.padding(start = 6.dp).background(Pal.surface2).cornerRadius(10.dp).padding(horizontal = 7.dp, vertical = 1.dp),
            )
        }
        if (plusRoute != null) {
            Box(GlanceModifier.size(48.dp).clickable(openApp(plusRoute)).semantics { contentDescription = "Nueva tarea" }, contentAlignment = Alignment.Center) {
                Box(GlanceModifier.size(34.dp).background(accent).cornerRadius(11.dp), contentAlignment = Alignment.Center) {
                    Image(ImageProvider(R.drawable.ic_w_plus), null, GlanceModifier.size(20.dp), colorFilter = ColorFilter.tint(Pal.onAccent))
                }
            }
        }
    }
}

@Composable
fun StatusLine(s: Snap) {
    if (!s.offline) return
    val at = s.savedAt?.let { " · " + DateTimeFormatter.ofPattern("dd/MM HH:mm").format(Instant.ofEpochMilli(it).atZone(AR)) } ?: ""
    val q = if (s.queued > 0) " · ${s.queued} por sincronizar" else ""
    Text("Sin conexión$at$q", style = TextStyle(color = Pal.muted, fontSize = 12.sp), modifier = GlanceModifier.padding(start = 8.dp, bottom = 4.dp))
}

/** Fila como la de la app: barra y cuadradito con el color de la materia, título y una línea de datos. */
@Composable
fun TaskRow(t: Todo, mat: Mat?, overdue: Boolean, route: String) {
    val m = Pal.mat(mat)
    val meta = listOfNotNull(
        if (overdue) "venció ${t.dueDate!!.substring(8)}/${t.dueDate.substring(5, 7)}" else t.dueTime,
        if (t.subTotal > 0) "${t.subDone}/${t.subTotal} subtareas" else null,
    ).joinToString(" · ")
    Row(GlanceModifier.fillMaxWidth().padding(vertical = 2.dp).background(Pal.surface).cornerRadius(12.dp).padding(start = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(GlanceModifier.width(3.dp).height(26.dp).background(m).cornerRadius(2.dp)) {}
        Box(
            GlanceModifier.size(44.dp)
                .clickable(actionRunCallback<ToggleAction>(actionParametersOf(idKey to t.id, doneKey to !t.completed)))
                .semantics { contentDescription = (if (t.completed) "Destildar " else "Completar ") + t.title },
            contentAlignment = Alignment.Center,
        ) {
            // Sin bordes en Glance: el contorno es un cuadrado de color con otro del fondo adentro.
            Box(GlanceModifier.size(20.dp).background(m).cornerRadius(6.dp), contentAlignment = Alignment.Center) {
                if (t.completed) Image(ImageProvider(R.drawable.ic_w_check), null, GlanceModifier.size(14.dp), colorFilter = ColorFilter.tint(Pal.bg))
                else Box(GlanceModifier.size(16.dp).background(Pal.surface).cornerRadius(4.dp)) {}
            }
        }
        Column(GlanceModifier.defaultWeight().padding(end = 8.dp, top = 7.dp, bottom = 7.dp).clickable(openApp(route))) {
            Text(
                t.title, maxLines = 1,
                style = TextStyle(
                    color = if (t.completed) Pal.faint else Pal.text, fontSize = 14.sp,
                    textDecoration = if (t.completed) TextDecoration.LineThrough else TextDecoration.None,
                ),
            )
            if (mat != null || meta.isNotEmpty()) Row(verticalAlignment = Alignment.CenterVertically) {
                if (mat != null) Text(mat.sigla, style = TextStyle(color = m, fontSize = 11.sp, fontWeight = FontWeight.Bold), modifier = GlanceModifier.padding(end = 6.dp))
                if (meta.isNotEmpty()) Text(meta, maxLines = 1, style = TextStyle(color = if (overdue) Pal.overdue else Pal.faint, fontSize = 11.sp))
            }
        }
    }
}
