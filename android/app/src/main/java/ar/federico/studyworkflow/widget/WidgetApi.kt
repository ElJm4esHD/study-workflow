package ar.federico.studyworkflow.widget

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** Destino "Mi servidor" (POST /api/sync/push y GET /api/sync/pull). Tira IOException si no hay red o el servidor responde mal. */
class ServerTarget(private val base: String, private val pageSize: Int = 1000) : Target {
    private fun call(path: String, method: String, body: String? = null): String {
        val c = URL(base + path).openConnection() as HttpURLConnection
        try {
            c.requestMethod = method
            c.connectTimeout = 8000
            c.readTimeout = 15000
            c.setRequestProperty("Accept", "application/json")
            if (body != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write(body.toByteArray()) }
            }
            val status = c.responseCode
            if (status !in 200..299) throw java.io.IOException("El servidor respondió $status")
            return c.inputStream.bufferedReader().use { it.readText() }
        } finally {
            c.disconnect()
        }
    }

    private fun toJson(r: Row) = JSONObject().put("t", r.t).put("id", r.id).put("data", r.data?.let { JSONObject(it) } ?: JSONObject.NULL).put("hlc", r.hlc)

    override fun push(records: List<Row>) {
        call("/api/sync/push", "POST", JSONObject().put("records", JSONArray(records.map(::toJson))).toString())
    }

    override fun pull(cursor: String?): Page {
        val q = "?limit=$pageSize" + (cursor?.takeIf { it.isNotEmpty() }?.let { "&since=" + URLEncoder.encode(it, "UTF-8") } ?: "")
        val o = JSONObject(call("/api/sync/pull$q", "GET"))
        val recs = o.getJSONArray("records")
        return Page(
            (0 until recs.length()).map { i -> recs.getJSONObject(i).let { Row(it.getString("t"), it.getString("id"), if (it.isNull("data")) null else it.getJSONObject("data").toString(), it.getString("hlc"), false) } },
            o.getString("cursor"), o.getBoolean("more"), if (o.has("reset")) o.getString("reset") else null,
        )
    }
}
