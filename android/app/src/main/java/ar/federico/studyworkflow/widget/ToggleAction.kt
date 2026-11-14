package ar.federico.studyworkflow.widget

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback

/** Tilda en la copia local, redibuja al toque y manda el cambio en segundo plano (la cola cubre el modo avión). */
class ToggleAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val id = parameters[idKey] ?: return
        val done = parameters[doneKey] ?: return
        runCatching {
            WidgetStore.toggle(context, id, done)
            ReminderScheduler.reschedule(context)
            redrawAll(context)
        }
        SyncWorker.schedule(context)
    }
}

/** "Tocá para reintentar". */
class RefreshAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        SyncWorker.schedule(context)
    }
}
