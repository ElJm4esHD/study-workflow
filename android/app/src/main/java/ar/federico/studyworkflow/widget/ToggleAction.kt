package ar.federico.studyworkflow.widget

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback

/** Tilda en la base del dispositivo (con un HLC nuevo), redibuja al toque y sube el cambio en segundo plano. */
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
