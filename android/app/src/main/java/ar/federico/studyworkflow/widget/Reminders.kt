package ar.federico.studyworkflow.widget

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import ar.federico.studyworkflow.MainActivity
import java.time.ZoneId
import org.json.JSONArray

/**
 * Recordatorios: se calculan de la copia local (WidgetStore) y se programan con AlarmManager,
 * así suenan sin conexión y con la app cerrada. Reprogramar es idempotente: la clave sale de la tarea o del evento.
 */
object ReminderScheduler {
    private const val CHANNEL = "recordatorios"
    private val AR = ZoneId.of("America/Argentina/Buenos_Aires")
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("sw_reminders", Context.MODE_PRIVATE)

    private fun intent(ctx: Context, key: String) =
        Intent(ctx, ReminderReceiver::class.java).setData(Uri.parse("sw://reminder/" + Uri.encode(key)))

    private fun pending(ctx: Context, key: String, r: Reminder? = null): PendingIntent {
        val i = intent(ctx, key)
        if (r != null) i.putExtra("title", r.title).putExtra("text", r.text).putExtra("route", r.route).putExtra("insistent", r.insistent)
        return PendingIntent.getBroadcast(ctx, 0, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    @Synchronized
    fun reschedule(ctx: Context) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val list = reminders(WidgetStore.todos(ctx).orEmpty(), WidgetStore.agenda(ctx)?.first.orEmpty(), System.currentTimeMillis(), AR)
        val keys = list.map { it.key }.toSet()
        // Lo que ya no está (tarea completada o borrada, recordatorio quitado) se cancela.
        val old = JSONArray(prefs(ctx).getString("keys", "[]"))
        for (i in 0 until old.length()) old.getString(i).takeIf { it !in keys }?.let { am.cancel(pending(ctx, it)) }
        val exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
        for (r in list) {
            val pi = pending(ctx, r.key, r)
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, r.at, pi) else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, r.at, pi)
        }
        prefs(ctx).edit().putString("keys", JSONArray(keys).toString()).apply()
    }

    fun show(ctx: Context, key: String, title: String, text: String, route: String?, insistent: Boolean) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        // Canal con uso "alarma": suena con el volumen de alarma, aunque el celu esté en silencio.
        val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Recordatorios", NotificationManager.IMPORTANCE_HIGH).apply {
            setSound(sound, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
            enableVibration(true)
        })
        val open = Intent(ctx, MainActivity::class.java).setData(Uri.parse("sw://open/" + Uri.encode(key)))
        if (route != null) open.putExtra(WidgetsPlugin.EXTRA_ROUTE, route)
        val n = Notification.Builder(ctx, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title).setContentText(text)
            .setCategory(Notification.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            .build()
        // Insistente: Android repite el sonido hasta que se baja la barra o se descarta la notificación.
        if (insistent) n.flags = n.flags or Notification.FLAG_INSISTENT
        nm.notify(key.hashCode(), n)
    }
}

/** Recibe la alarma de un recordatorio; también reprograma después de reiniciar el celu o actualizar la app. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        runCatching {
            if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
                ReminderScheduler.reschedule(ctx)
                return
            }
            val key = intent.data?.lastPathSegment ?: return
            ReminderScheduler.show(
                ctx, key, intent.getStringExtra("title") ?: "Recordatorio", intent.getStringExtra("text").orEmpty(),
                intent.getStringExtra("route"), intent.getBooleanExtra("insistent", false),
            )
        }
    }
}
