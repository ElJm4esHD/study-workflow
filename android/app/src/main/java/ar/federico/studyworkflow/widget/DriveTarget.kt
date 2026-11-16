package ar.federico.studyworkflow.widget

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

/** El archivo ya no existe (otro dispositivo compactó entre el listado y la lectura). */
class NotFound : IOException()
/** Falta una sesión de Google vigente: hay que abrir la app y reconectar. No es un fallo de red (no se reintenta). */
class AuthException(msg: String = "Falta reconectar Google Drive.") : Exception(msg)

/** Lo mínimo de Drive que usa el adaptador (igual que `DriveFiles` en core/web/sync/drive.ts). */
interface DriveFiles {
    fun list(): List<Pair<String, String>> // (id, nombre)
    fun read(id: String): String // NotFound si ya no existe
    fun create(name: String, body: String)
    fun remove(id: String) // si ya no existe, no falla
}

/**
 * Destino "Google Drive": el mismo algoritmo que core/web/sync/drive.ts (los dos corren los casos `drive` de sync-cases.json).
 * Archivos que nunca se modifican en appDataFolder: epoch-*, log-<hlc>-*, snap-<hlc>-<p|n>.json. El cursor es el conjunto de archivos ya leídos.
 */
class DriveTarget(
    private val fs: DriveFiles,
    private val now: () -> Long = System::currentTimeMillis,
    private val compactAt: Int = 200,
    private val page: Int = 50,
) : Target {
    private var epochOk = false
    private class Cur(var e: String?, var s: MutableList<String>, var l: MutableList<String>)

    private fun group(): LinkedHashMap<String, MutableList<String>> {
        val m = LinkedHashMap<String, MutableList<String>>() // Drive permite nombres repetidos: se tratan como un solo archivo
        for ((id, name) in fs.list()) m.getOrPut(name) { mutableListOf() }.add(id)
        return m
    }

    private fun parse(raw: String?): Cur? {
        if (raw.isNullOrEmpty()) return null
        return try {
            val o = JSONObject(raw)
            if (o.optInt("v") != 1) return null
            fun arr(k: String) = o.getJSONArray(k).let { a -> (0 until a.length()).map { a.getString(it) }.toMutableList() }
            Cur(if (o.isNull("e")) null else o.getString("e"), arr("s"), arr("l"))
        } catch (_: Exception) { null } // un cursor que no es de Drive se trata como dispositivo nuevo
    }

    private fun write(c: Cur) = JSONObject().put("v", 1).put("e", c.e ?: JSONObject.NULL).put("s", JSONArray(c.s)).put("l", JSONArray(c.l)).toString()

    private val tRe = Regex("^[a-z][a-z0-9_]{0,39}$")
    private val hlcRe = Regex("^\\d{13}-[0-9a-f]{4}-[A-Za-z0-9-]{1,40}$")
    private fun valid(o: JSONObject): Boolean =
        tRe.matches(o.optString("t")) && o.optString("id").let { it.isNotEmpty() && it.length <= 100 } &&
            hlcRe.matches(o.optString("hlc")) && (o.has("data") && (o.isNull("data") || o.optJSONObject("data") != null))

    private fun readRecs(files: Map<String, List<String>>, name: String): List<Row> {
        val arr = JSONObject(fs.read(files.getValue(name)[0])).optJSONArray("records") ?: return emptyList()
        return (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }.filter(::valid)
            .map { Row(it.getString("t"), it.getString("id"), if (it.isNull("data")) null else it.getJSONObject("data").toString(), it.getString("hlc"), false) }
    }

    private fun toJson(r: Row) = JSONObject().put("t", r.t).put("id", r.id).put("data", r.data?.let(::JSONObject) ?: JSONObject.NULL).put("hlc", r.hlc)

    private fun drop(files: Map<String, List<String>>, names: List<String>) = names.forEach { n -> files[n]?.forEach(fs::remove) }

    /** Junta todo en un snapshot y borra solo lo que incluyó. Si otro dispositivo compactó en el medio, se saltea. */
    private fun compact(files: Map<String, List<String>>, names: List<String>): String? {
        val best = HashMap<String, Row>()
        try {
            for (n in names) for (r in readRecs(files, n)) {
                val k = "${r.t}\u0000${r.id}"
                if (best[k] == null || r.hlc > best[k]!!.hlc) best[k] = r
            }
        } catch (_: NotFound) { return null }
        val all = best.values.toList()
        val keep = all.filter { !(it.data == null && tombstoneExpired(it.hlc, now())) }
        val top = all.maxOfOrNull { it.hlc } ?: return null
        val snap = "snap-$top-${if (keep.size < all.size) "p" else "n"}.json"
        if (!files.containsKey(snap)) fs.create(snap, JSONObject().put("records", JSONArray(keep.map(::toJson))).toString())
        drop(files, names.filter { it != snap })
        return snap
    }

    private fun pullOnce(cursor: String?): Page {
        val files = group()
        val names = files.keys.toList()
        val epochs = names.filter { it.startsWith("epoch-") }.sorted()
        val epoch = epochs.firstOrNull()
        epochOk = epoch != null
        if (epochs.size > 1) drop(files, epochs.drop(1)) // carrera al crearlo: vale el menor
        val snaps = names.filter { it.startsWith("snap-") }.sorted()
        val logs = names.filter { it.startsWith("log-") }.sorted()

        var reset: String? = null
        val old = parse(cursor)
        var c: Cur
        if (old == null) c = Cur(epoch, mutableListOf(), mutableListOf())
        else if (old.e != null && old.e != epoch) { reset = "epoch"; c = Cur(epoch, mutableListOf(), mutableListOf()) } // otra carpeta o borrada: lectura completa
        else if (snaps.any { it !in old.s && it.endsWith("-p.json") }) { reset = "purged"; c = Cur(epoch, mutableListOf(), mutableListOf()) } // se descartaron marcas de borrado
        else c = Cur(epoch, old.s.filter { files.containsKey(it) }.toMutableList(), old.l.filter { files.containsKey(it) }.toMutableList())

        val unread = snaps.filter { it !in c.s } + logs.filter { it !in c.l }
        val records = ArrayList<Row>()
        for (n in unread.take(page)) {
            records.addAll(readRecs(files, n))
            (if (n.startsWith("snap-")) c.s else c.l).add(n)
        }
        val more = unread.size > page
        if (!more && logs.size > compactAt) {
            compact(files, snaps + logs)?.let { c.s = mutableListOf(it); c.l = mutableListOf() } // lo que llegó después se lee en el próximo pull
        }
        return Page(records, write(c), more, reset)
    }

    override fun pull(cursor: String?): Page = try { pullOnce(cursor) } catch (_: NotFound) { pullOnce(cursor) } // otro dispositivo compactó entre el listado y la lectura

    override fun push(records: List<Row>) {
        if (records.isEmpty()) return
        if (!epochOk) {
            if (group().keys.none { it.startsWith("epoch-") }) fs.create("epoch-${UUID.randomUUID()}.json", "{}")
            epochOk = true
        }
        val top = records.maxOf { it.hlc }
        fs.create("log-$top-${"%08x".format(java.util.Random().nextInt())}.json", JSONObject().put("records", JSONArray(records.map(::toJson))).toString())
    }
}

/** Drive real (REST v3, solo appDataFolder). `token()` da un access token vigente o tira AuthException. */
class DriveRest(private val token: () -> String) : DriveFiles {
    private val api = "https://www.googleapis.com"

    private fun call(url: String, method: String = "GET", contentType: String? = null, body: String? = null): String {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod = method
            c.connectTimeout = 8000
            c.readTimeout = 20000
            c.setRequestProperty("Authorization", "Bearer ${token()}")
            if (body != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", contentType ?: "application/json")
                c.outputStream.use { it.write(body.toByteArray()) }
            }
            val s = c.responseCode
            if (s == 401) throw AuthException("La sesión de Google venció.")
            if (s == 404) throw NotFound()
            if (s !in 200..299) throw IOException("Google Drive respondió $s")
            return c.inputStream.bufferedReader().use { it.readText() }
        } finally { c.disconnect() }
    }

    override fun list(): List<Pair<String, String>> {
        val out = ArrayList<Pair<String, String>>()
        var next = ""
        do {
            val o = JSONObject(call("$api/drive/v3/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name)$next"))
            o.optJSONArray("files")?.let { a -> for (i in 0 until a.length()) out.add(a.getJSONObject(i).let { it.getString("id") to it.getString("name") }) }
            next = if (o.has("nextPageToken")) "&pageToken=" + URLEncoder.encode(o.getString("nextPageToken"), "UTF-8") else ""
        } while (next.isNotEmpty())
        return out
    }

    override fun read(id: String) = call("$api/drive/v3/files/${URLEncoder.encode(id, "UTF-8")}?alt=media")

    override fun create(name: String, body: String) {
        val b = "swboundary"
        val meta = JSONObject().put("name", name).put("parents", JSONArray(listOf("appDataFolder"))).put("mimeType", "application/json")
        call("$api/upload/drive/v3/files?uploadType=multipart", "POST", "multipart/related; boundary=$b",
            "--$b\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n$meta\r\n--$b\r\nContent-Type: application/json\r\n\r\n$body\r\n--$b--")
    }

    override fun remove(id: String) {
        try { call("$api/drive/v3/files/${URLEncoder.encode(id, "UTF-8")}", "DELETE") } catch (_: NotFound) {}
    }
}
