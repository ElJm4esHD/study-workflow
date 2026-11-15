package ar.federico.studyworkflow.widget

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// Un solo sync a la vez en este proceso (el de la app abierta corre aparte, en JavaScript: es idempotente).
private val SYNC_LOCK = Any()

/**
 * Trabajo en segundo plano: sincroniza la base del dispositivo con el servidor (net = true), reprograma los
 * recordatorios y redibuja el widget. Con net = false solo refresca lo local (después de que la app escribió).
 */
class SyncWorker(private val ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        if (inputData.getBoolean("net", true)) {
            try {
                withContext(Dispatchers.IO) { synchronized(SYNC_LOCK) { sync() } }
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                // un widget nunca debe romper: se reintenta en el próximo disparo
            }
        }
        runCatching { ReminderScheduler.reschedule(ctx) }
        runCatching { redrawAll(ctx) }
        // Las tachadas de 3 s desaparecen en un trabajo aparte (otro nombre, para no cancelar este).
        WidgetStore.nextKeepExpiry(ctx)?.let { schedule(ctx, it - System.currentTimeMillis() + 100, "sw-sync-keep", net = false) }
        return Result.success()
    }

    private fun sync() {
        val base = WidgetStore.server(ctx) ?: return
        val db = SwDb.get(ctx)
        val store = SqlStore(db)
        var retry = false
        try {
            SyncCore.sync(store, store.clock(), ServerTarget(base), System.currentTimeMillis())
            WidgetStore.setOffline(ctx, false)
        } catch (e: Exception) {
            // IOException = sin red o el server respondió mal; cualquier otra cosa (p. ej. un proxy que devuelve HTML) también se reintenta.
            if (e is IOException) WidgetStore.setOffline(ctx, true)
            retry = true
        }
        if (retry || WidgetStore.queued(ctx) > 0) scheduleOnNetwork(ctx)
    }

    companion object {
        /** `net`: además de refrescar, sincronizar con el servidor. Los nombres distintos evitan que uno cancele al otro. */
        fun schedule(ctx: Context, delayMs: Long = 0, name: String = "sw-sync", net: Boolean = true) {
            val req = OneTimeWorkRequestBuilder<SyncWorker>()
                .setInitialDelay(delayMs.coerceAtLeast(0), TimeUnit.MILLISECONDS)
                .setInputData(Data.Builder().putBoolean("net", net).build()).build()
            WorkManager.getInstance(ctx).enqueueUniqueWork(name, ExistingWorkPolicy.REPLACE, req)
        }

        /** Solo refresca lo local (recordatorios y widget): lo llama el plugin cuando la app escribió. */
        fun refreshLocal(ctx: Context) = schedule(ctx, 0, "sw-local", net = false)

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
