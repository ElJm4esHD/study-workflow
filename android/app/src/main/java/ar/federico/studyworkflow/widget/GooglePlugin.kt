package ar.federico.studyworkflow.widget

import android.app.Activity
import android.content.Intent
import ar.federico.studyworkflow.MainActivity
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity

/** Puente web ↔ sesión de Google (solo drive.appdata). `token({ interactive })`: con interactive = false nunca muestra pantallas. */
@CapacitorPlugin(name = "Google")
class GooglePlugin : Plugin() {
    companion object {
        private var pending: PluginCall? = null

        private fun answer(call: PluginCall, r: AuthorizationResult) {
            val t = r.accessToken
            if (t == null) call.reject("No se pudo conectar con Google.", "auth") else call.resolve(JSObject().put("token", t))
        }

        /** Lo llama MainActivity cuando vuelve la pantalla de permiso de Google. */
        @JvmStatic
        fun onResult(act: Activity, code: Int, data: Intent?) {
            val call = pending ?: return
            pending = null
            if (code != Activity.RESULT_OK || data == null) { call.reject("Cerraste la ventana de Google antes de terminar.", "cancelled"); return }
            try { answer(call, Identity.getAuthorizationClient(act).getAuthorizationResultFromIntent(data)) }
            catch (e: Exception) { call.reject("No se pudo conectar con Google.", "auth") }
        }
    }

    @PluginMethod
    fun token(call: PluginCall) {
        val interactive = call.getBoolean("interactive", false) == true
        GoogleAuth.authorize(context)
            .addOnSuccessListener { r ->
                if (!r.hasResolution()) answer(call, r)
                else if (!interactive) call.reject("Falta reconectar Google Drive.", "auth")
                else {
                    pending = call
                    val a = activity as? MainActivity
                    if (a == null) { pending = null; call.reject("No se pudo abrir la ventana de Google.", "auth") }
                    else a.launchGoogle(r.pendingIntent!!.intentSender)
                }
            }
            .addOnFailureListener { call.reject("No se pudo conectar con Google. ¿Tenés Google Play Services?", "auth") }
    }
}
