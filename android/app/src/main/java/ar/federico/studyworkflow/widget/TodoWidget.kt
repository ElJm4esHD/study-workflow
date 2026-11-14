package ar.federico.studyworkflow.widget

import android.content.Context
import androidx.compose.runtime.remember
import androidx.glance.GlanceId
import androidx.glance.LocalContext
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.fillMaxWidth
import androidx.glance.GlanceModifier
import android.appwidget.AppWidgetManager

class TodoWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val rev = currentState(REV)
            val ctx = LocalContext.current
            val s = remember(rev) { snapshot(ctx) }
            Root {
                when {
                    s == null || (s.server != null && s.todos == null) -> Message("No pude cargar. Tocá para reintentar.", actionRunCallback<RefreshAction>())
                    s.server == null -> Message("Abrí Study Workflow para conectar.", openApp(null))
                    else -> {
                        val rows = todoList(s.todos!!, s.keep)
                        Header("To-do", s.todos.count { !it.completed }, route = "/todo", plusRoute = "/todo/nueva")
                        StatusLine(s)
                        if (rows.isEmpty()) Message("Nada pendiente.", openApp(null))
                        else LazyColumn(GlanceModifier.fillMaxWidth()) {
                            items(rows, itemId = { it.id.hashCode().toLong() }) { t ->
                                TaskRow(t, t.materiaId?.let { s.mats[it] }, isOverdue(t, s.today) && !t.completed, "/todo/${t.id}")
                            }
                        }
                    }
                }
            }
        }
    }
}

class TodoWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TodoWidget()
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        SyncWorker.schedule(context)
    }
}
