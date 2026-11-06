package ar.federico.studyworkflow.widget

import android.content.Intent
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

    @PluginMethod
    fun takeRoute(call: PluginCall) {
        val o = JSObject()
        o.put("route", pending ?: JSObject.NULL)
        pending = null
        call.resolve(o)
    }
}
