package ar.federico.studyworkflow.widget

import java.net.HttpURLConnection
import java.net.URL

object WidgetApi {
    class Http(val status: Int, val body: String)

    private fun call(base: String, path: String, method: String, body: String? = null): Http {
        val c = URL(base + path).openConnection() as HttpURLConnection
        try {
            c.requestMethod = method
            c.connectTimeout = 8000
            c.readTimeout = 8000
            c.setRequestProperty("Accept", "application/json")
            if (body != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write(body.toByteArray()) }
            }
            val status = c.responseCode
            val stream = if (status >= 400) c.errorStream else c.inputStream
            return Http(status, stream?.bufferedReader()?.use { it.readText() }.orEmpty())
        } finally {
            c.disconnect()
        }
    }

    /** Tira IOException si no hay red. */
    fun get(base: String, path: String) = call(base, path, "GET")
    fun patchCompleted(base: String, id: String, completed: Boolean) =
        call(base, "/api/todo/$id", "PATCH", """{"completed":$completed}""")
}
