package ar.federico.studyworkflow.widget

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.io.IOException
import java.time.LocalDate
import java.time.ZoneId
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

// shortcut: la cola del widget y la de la app son independientes; un tilde offline del widget
// no se ve en la app offline hasta que vuelva la red. Unificar solo si molesta en el uso real.
private val SYNC_LOCK = Any()

class SyncWorker(private val ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        try {
            // Un solo sync a la vez: si no, uno viejo podría guardar datos anteriores al PATCH del nuevo.
            withContext(Dispatchers.IO) { synchronized(SYNC_LOCK) { sync() } }
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            // un widget nunca debe romper: se reintenta en el próximo disparo
        }
        runCatching { redrawAll(ctx) }
        // Las tachadas de 3 s desaparecen en un trabajo aparte (otro nombre, para no cancelar este).
        WidgetStore.nextKeepExpiry(ctx)?.let { schedule(ctx, it - System.currentTimeMillis() + 100, "sw-sync-keep") }
        return Result.success()
    }

    private fun sync() {
        val base = WidgetStore.server(ctx) ?: return
        var retry = false
        try {
            retry = !flush(base)
            val today = LocalDate.now(ZoneId.of("America/Argentina/Buenos_Aires"))
            val t = WidgetApi.get(base, "/api/todo")
            val a = WidgetApi.get(base, "/api/calendar/agenda?from=$today&to=${today.plusDays(7)}")
            val m = WidgetApi.get(base, "/api/materias")
            if (t.status == 200 && a.status == 200 && m.status == 200) {
                WidgetStore.saveAll(ctx, t.body, a.body, m.body)
                WidgetStore.setOffline(ctx, false)
            } else retry = true
        } catch (e: Exception) {
            // IOException = sin red; cualquier otra cosa (p. ej. un proxy que devuelve HTML) también se reintenta.
            if (e is IOException) WidgetStore.setOffline(ctx, true)
            retry = true
        }
        if (retry || WidgetStore.queue(ctx).isNotEmpty()) scheduleOnNetwork(ctx)
    }

    /** Sube la cola con la regla de la app; devuelve false si hay que reintentar. */
    private fun flush(base: String): Boolean {
        for (op in WidgetStore.queue(ctx)) {
            val cur = WidgetApi.get(base, "/api/todo/${op.id}")
            if (cur.status != 200 && cur.status != 404) return false
            val server = if (cur.status == 200) JSONObject(cur.body).optString("updatedAt").takeIf { it.isNotEmpty() } else null
            if (shouldSend(op, cur.status, server)) {
                val r = WidgetApi.patchCompleted(base, op.id, op.completed)
                if (r.status >= 500) return false
                if (r.status in 200..299) {
                    JSONObject(r.body).optString("updatedAt").takeIf { it.isNotEmpty() }?.let { WidgetStore.setUpdatedAt(ctx, op.id, it) }
                }
            }
            // Si el usuario volvió a tocar mientras tanto, el op nuevo (otro `at`) se conserva.
            WidgetStore.dropOp(ctx, op)
        }
        return true
    }

    companion object {
        fun schedule(ctx: Context, delayMs: Long = 0, name: String = "sw-sync") {
            val req = OneTimeWorkRequestBuilder<SyncWorker>().setInitialDelay(delayMs.coerceAtLeast(0), TimeUnit.MILLISECONDS).build()
            WorkManager.getInstance(ctx).enqueueUniqueWork(name, ExistingWorkPolicy.REPLACE, req)
        }

        // REPLACE (no KEEP): el reintento se encola desde el propio worker "sw-sync-net" y KEEP lo descartaba.
        // El minuto de espera evita un bucle contra un servidor caído.
        fun scheduleOnNetwork(ctx: Context) {
            val req = OneTimeWorkRequestBuilder<SyncWorker>()
                .setInitialDelay(1, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            WorkManager.getInstance(ctx).enqueueUniqueWork("sw-sync-net", ExistingWorkPolicy.REPLACE, req)
        }
    }
}
