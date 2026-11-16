package ar.federico.studyworkflow.widget

import android.content.Context
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import com.google.android.gms.tasks.Tasks

/** Sesión de Google en el celu: solo el permiso drive.appdata. Google Play Services renueva el token solo; no hay secretos en el código. */
object GoogleAuth {
    private fun request() = AuthorizationRequest.builder().setRequestedScopes(listOf(Scope("https://www.googleapis.com/auth/drive.appdata"))).build()

    /** Desde la app: el resultado puede pedir mostrar la pantalla de permiso (`hasResolution`). */
    fun authorize(ctx: Context) = Identity.getAuthorizationClient(ctx).authorize(request())

    /** Desde un hilo de fondo (SyncWorker): token vigente, o AuthException si falta el permiso o hay que volver a entrar. Bloquea. */
    fun silentToken(ctx: Context): String {
        val r: AuthorizationResult = try { Tasks.await(authorize(ctx)) } catch (e: Exception) { throw AuthException("No se pudo renovar la sesión de Google.") }
        if (r.hasResolution()) throw AuthException()
        return r.accessToken ?: throw AuthException()
    }
}
