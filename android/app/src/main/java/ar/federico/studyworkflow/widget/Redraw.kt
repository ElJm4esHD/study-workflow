package ar.federico.studyworkflow.widget

import android.content.Context
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState

/** Cambia este valor para que Glance vuelva a componer con lo guardado en WidgetStore. */
val REV = longPreferencesKey("rev")

suspend fun redrawAll(ctx: Context) {
    val manager = GlanceAppWidgetManager(ctx)
    for (w in listOf<GlanceAppWidget>(TodoWidget(), AgendaWidget())) {
        for (id in manager.getGlanceIds(w.javaClass)) {
            updateAppWidgetState(ctx, id) { it[REV] = System.currentTimeMillis() }
            w.update(ctx, id)
        }
    }
}
