package ar.federico.studyworkflow.widget

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/** Puente web ↔ widgets: URL del servidor, pedido de refresco y ruta pedida desde un widget. */
@CapacitorPlugin(name = "Widgets")
class WidgetsPlugin : Plugin() {
    companion object {
        const val EXTRA_ROUTE = "sw_route"

        /** El modo nocturno propio de la app (persiste en el sistema): el splash del próximo arranque ya sale con el tema elegido. */
        fun applyNightMode(ctx: android.content.Context, mode: String) {
            if (Build.VERSION.SDK_INT < 31) return
            val um = ctx.getSystemService(android.app.UiModeManager::class.java) ?: return
            um.setApplicationNightMode(when (mode) { "light" -> android.app.UiModeManager.MODE_NIGHT_NO; "system" -> android.app.UiModeManager.MODE_NIGHT_AUTO; else -> android.app.UiModeManager.MODE_NIGHT_YES })
        }
        private var pending: String? = null

        /** Lo llama MainActivity en onCreate y onNewIntent; true si el intent traía una ruta. */
        @JvmStatic
        fun capture(intent: Intent?): Boolean {
            val r = intent?.getStringExtra(EXTRA_ROUTE)
            if (r.isNullOrEmpty()) return false
            pending = r
            return true
        }
    }

    fun deliver() {
        // Sin listener (app en Conectar o rutas sin montar) la ruta se queda para takeRoute().
        if (!hasListeners("route")) return
        val r = pending ?: return
        pending = null
        notifyListeners("route", JSObject().put("route", r))
    }

    @PluginMethod
    fun setServer(call: PluginCall) {
        WidgetStore.setServer(context, call.getString("url"))
        SyncWorker.schedule(context)
        call.resolve()
    }

    @PluginMethod
    fun refresh(call: PluginCall) {
        SyncWorker.schedule(context)
        call.resolve()
    }

    /** Android 13+: sin este permiso los recordatorios no se muestran. Se pide al poner el primero. */
    @PluginMethod
    fun askNotifications(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        call.resolve()
    }

    /** El color de acento de la app: se guarda y, si cambió, se vuelve a dibujar el widget. */
    @PluginMethod
    fun setAccent(call: PluginCall) {
        val hex = call.getString("hex")
        if (hex != null && runCatching { android.graphics.Color.parseColor(hex) }.isSuccess) {
            val light = call.getString("light")?.takeIf { runCatching { android.graphics.Color.parseColor(it) }.isSuccess }
            val changed = WidgetStore.accent(context) != android.graphics.Color.parseColor(hex) || light != null && WidgetStore.accentLight(context) != android.graphics.Color.parseColor(light)
            WidgetStore.setAccent(context, hex, light)
            if (changed) SyncWorker.schedule(context)
        }
        call.resolve()
    }

    /** Tema de la app ("dark", "light" o "system"): lo usan el widget y, desde Android 12, el splash y las barras del sistema. */
    @PluginMethod
    fun setTheme(call: PluginCall) {
        val mode = call.getString("mode")?.takeIf { it in setOf("dark", "light", "system") } ?: return call.reject("Tema inválido")
        if (WidgetStore.theme(context) != mode) {
            WidgetStore.setTheme(context, mode)
            SyncWorker.schedule(context)
        }
        applyNightMode(context, mode)
        call.resolve()
    }

    /** "Probar sonido" de Ajustes: un recordatorio de verdad, ahora, para oír el canal. */
    @PluginMethod
    fun testReminder(call: PluginCall) {
        ReminderScheduler.show(context, "prueba", "Probando el recordatorio", "Así suena. Si no lo oís, revisá el volumen de alarmas.", null, call.getBoolean("insistent", false) == true)
        call.resolve()
    }

    @PluginMethod
    fun setDone(call: PluginCall) {
        val id = call.getString("id")
        if (id != null) runCatching {
            WidgetStore.setCompletedLocal(context, id, call.getBoolean("completed", true) == true)
            ReminderScheduler.reschedule(context)
        }
        SyncWorker.schedule(context)
        call.resolve()
    }

    @PluginMethod
    fun takeRoute(call: PluginCall) {
        val o = JSObject()
        o.put("route", pending ?: JSObject.NULL)
        pending = null
        call.resolve(o)
    }

}
