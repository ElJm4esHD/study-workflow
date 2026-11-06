package ar.federico.studyworkflow.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Row
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

private sealed interface Item {
    data class Head(val date: String, val label: String) : Item
    data class Exam(val ev: Ev, val date: String) : Item
    data class Event(val ev: Ev, val date: String) : Item
    data class Task(val t: Todo, val date: String) : Item
}

private fun agendaItems(days: List<Day>, today: String): List<Item> = days.flatMap { d ->
    listOf<Item>(Item.Head(d.date, dayLabel(d.date, today))) +
        d.exams.map { Item.Exam(it, d.date) } + d.events.map { Item.Event(it, d.date) } + d.todos.map { Item.Task(it, d.date) }
}

private fun time(e: Ev) = if (e.allDay) "Todo el día" else e.startTime.orEmpty()

class AgendaWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val rev = currentState(REV)
            val ctx = LocalContext.current
            val s = remember(rev) { snapshot(ctx) }
            Root {
                when {
                    s == null || (s.server != null && s.events == null) -> Message("No pude cargar. Tocá para reintentar.", actionRunCallback<RefreshAction>())
                    s.server == null -> Message("Abrí Study Workflow para conectar.", openApp(null))
                    else -> {
                        val list = agendaItems(agendaDays(s.events!!, s.agendaTodos.orEmpty(), s.today, s.keep), s.today)
                        Header("Agenda", route = dayRoute(s.today))
                        StatusLine(s)
                        if (list.isEmpty()) Message("Nada en los próximos 7 días.", openApp(dayRoute(s.today)))
                        else LazyColumn(GlanceModifier.fillMaxWidth()) {
                            items(list, itemId = { it.hashCode().toLong() }) { row -> AgendaRow(row, s) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AgendaRow(row: Item, s: Snap) {
    when (row) {
        is Item.Head -> Text(
            row.label, maxLines = 1,
            style = TextStyle(color = ColorProvider(Pal.muted), fontSize = 12.5.sp, fontWeight = FontWeight.Medium),
            modifier = GlanceModifier.fillMaxWidth().padding(start = 4.dp, top = 8.dp, bottom = 2.dp).clickable(openApp(dayRoute(row.date))),
        )
        is Item.Exam -> {
            val m = row.ev.materiaId?.let { s.mats[it] }
            val text = listOfNotNull(row.ev.kind.replaceFirstChar { it.uppercase() }, m?.sigla?.takeIf { it.isNotBlank() }, time(row.ev).takeIf { it.isNotBlank() }, row.ev.title)
                .joinToString(" · ")
            Box(GlanceModifier.fillMaxWidth().padding(vertical = 2.dp).clickable(openApp(dayRoute(row.date)))) {
                Box(GlanceModifier.fillMaxWidth().background(hex(m?.colorStrong, Pal.neutralStrong)).cornerRadius(8.dp).padding(horizontal = 10.dp, vertical = 8.dp)) {
                    Text(text, maxLines = 2, style = TextStyle(color = ColorProvider(Color.White), fontSize = 14.sp, fontWeight = FontWeight.Medium))
                }
            }
        }
        is Item.Event -> Row(
            GlanceModifier.fillMaxWidth().height(40.dp).clickable(openApp(dayRoute(row.date))),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val m = row.ev.materiaId?.let { s.mats[it] }
            Box(GlanceModifier.padding(horizontal = 6.dp)) {
                Box(GlanceModifier.size(8.dp).background(hex(m?.color, Pal.neutral)).cornerRadius(4.dp)) {}
            }
            Text(time(row.ev), maxLines = 1, style = TextStyle(color = ColorProvider(Pal.muted), fontSize = 12.5.sp), modifier = GlanceModifier.padding(end = 8.dp))
            Text(row.ev.title, maxLines = 1, style = TextStyle(color = ColorProvider(Pal.text), fontSize = 14.5.sp), modifier = GlanceModifier.defaultWeight())
        }
        is Item.Task -> TaskRow(row.t, row.t.materiaId?.let { s.mats[it] }, false, dayRoute(row.date))
    }
}

class AgendaWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = AgendaWidget()
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        SyncWorker.schedule(context)
    }
}
