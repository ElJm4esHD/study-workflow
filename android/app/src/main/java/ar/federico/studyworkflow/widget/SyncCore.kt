package ar.federico.studyworkflow.widget

import org.json.JSONObject
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Motor de sincronización del lado nativo (widget y sync de fondo). Es el mismo algoritmo que core/web/sync (TypeScript):
 * registros con HLC, gana el mayor, `dirty` = sin subir. Los dos corren core/shared/sync-cases.json (SyncCasesTest / cases.test.ts).
 */
data class Row(val t: String, val id: String, val data: String?, val hlc: String, val dirty: Boolean)

interface RecStore {
    fun get(t: String, id: String): Row?
    fun all(): List<Row>
    fun dirty(): List<Row>
    /** Guarda cada fila salvo que ya haya una con HLC mayor. */
    fun put(rows: List<Row>)
    fun delete(keys: List<Pair<String, String>>)
    fun meta(k: String): String?
    fun setMeta(k: String, v: String)
    fun <T> tx(fn: () -> T): T
}

class Page(val records: List<Row>, val cursor: String, val more: Boolean, val reset: String?)
interface Target {
    fun push(records: List<Row>)
    fun pull(cursor: String?): Page
}

/** Reloj lógico híbrido: nunca retrocede. Formato `ms(13)-contador(4 hex)-nodo`, ordenable como texto. */
class Hlc(val node: String, private val now: () -> Long = System::currentTimeMillis) {
    private var ms = 0L
    private var c = 0

    @Synchronized fun tick(): String {
        val t = now()
        if (t > ms) { ms = t; c = 0 } else c++
        if (c > 0xffff) { ms++; c = 0 }
        return format()
    }

    @Synchronized fun recv(h: String) {
        val rms = h.substring(0, 13).toLong()
        val rc = h.substring(14, 18).toInt(16)
        val m = maxOf(ms, rms, now())
        c = if (m == ms && m == rms) maxOf(c, rc) + 1 else if (m == ms) c + 1 else if (m == rms) rc + 1 else 0
        ms = m
    }

    private fun format() = "%013d-%04x-%s".format(ms, c, node)
}

const val TOMBSTONE_DAYS = 180L
fun hlcMs(h: String): Long = h.substring(0, 13).toLong()
fun tombstoneExpired(hlc: String, nowMs: Long) = hlcMs(hlc) < nowMs - TOMBSTONE_DAYS * 86_400_000L

object SyncCore {
    private const val BATCH = 500
    private fun key(t: String, id: String) = "$t\u0000$id"

    /** Mezcla lo que llegó del destino; devuelve cuántos registros cambiaron. */
    fun merge(store: RecStore, clock: Hlc, recs: List<Row>): Int {
        val staged = LinkedHashMap<String, Row>()
        for (r in recs) {
            clock.recv(r.hlc)
            val mine = staged[key(r.t, r.id)] ?: store.get(r.t, r.id)
            if (mine != null && r.hlc <= mine.hlc) continue
            staged[key(r.t, r.id)] = r.copy(dirty = false)
        }
        if (staged.isNotEmpty()) store.put(staged.values.toList())
        return staged.size
    }

    /** Marca como subidos los confirmados, salvo los que se volvieron a editar mientras tanto. */
    fun markPushed(store: RecStore, recs: List<Row>) {
        val ok = recs.mapNotNull { r -> store.get(r.t, r.id)?.takeIf { it.hlc == r.hlc && it.dirty }?.copy(dirty = false) }
        if (ok.isNotEmpty()) store.put(ok)
    }

    fun markAllDirty(store: RecStore) {
        val rows = store.all().filter { !it.dirty }.map { it.copy(dirty = true) }
        if (rows.isNotEmpty()) store.put(rows)
    }

    private fun pushDirty(store: RecStore, target: Target): Int {
        val dirty = store.dirty()
        for (batch in dirty.chunked(BATCH)) {
            target.push(batch)
            markPushed(store, batch)
        }
        return dirty.size
    }

    /** Un ciclo: sube lo sucio y baja lo remoto. Si algo falla (excepción), lo no subido sigue marcado. */
    fun sync(store: RecStore, clock: Hlc, target: Target, nowMs: Long): Int {
        var pushed = pushDirty(store, target)
        var cursor = store.meta("cursor")
        var full: MutableSet<String>? = null // 'purged': al final se saca lo que el destino ya no tiene
        var again = false // 'epoch': el destino perdió datos o es otro: se vuelve a subir todo
        var pulled = 0
        while (true) {
            val page = target.pull(cursor)
            if (page.reset == "purged" && full == null) full = HashSet()
            if (page.reset == "epoch" && !again) { again = true; markAllDirty(store) }
            pulled += merge(store, clock, page.records)
            full?.let { s -> page.records.forEach { s.add(key(it.t, it.id)) } }
            cursor = page.cursor
            if (full == null && !again) store.setMeta("cursor", cursor)
            if (!page.more) break
        }
        full?.let { seen ->
            val drop = store.all().filter { !it.dirty && key(it.t, it.id) !in seen }.map { it.t to it.id }
            if (drop.isNotEmpty()) store.delete(drop)
        }
        if (full != null || again) store.setMeta("cursor", cursor!!)
        if (again) pushed += pushDirty(store, target)
        val old = store.all().filter { it.data == null && !it.dirty && tombstoneExpired(it.hlc, nowMs) }.map { it.t to it.id }
        if (old.isNotEmpty()) store.delete(old)
        store.setMeta("lastSync", Instant.ofEpochMilli(nowMs).toString())
        return pulled + pushed
    }

    /**
     * Tildar desde el widget: misma regla que todo.update({ completed }) de la app (completed, completedAt y updatedAt),
     * con un HLC nuevo y la fila sin subir.
     */
    fun setCompleted(store: RecStore, clock: Hlc, id: String, completed: Boolean, nowIso: String): Boolean = store.tx {
        val row = store.get("todo_items", id)
        val json = row?.data ?: return@tx false
        val doc = JSONObject(json)
        val was = doc.optBoolean("completed")
        doc.put("completed", completed)
        doc.put("completedAt", if (!completed) JSONObject.NULL else if (was) doc.opt("completedAt") ?: nowIso else nowIso)
        doc.put("updatedAt", nowIso)
        store.put(listOf(Row("todo_items", id, doc.toString(), clock.tick(), true)))
        true
    }

    fun nowIso(): String = Instant.now().truncatedTo(ChronoUnit.MILLIS).toString()
}
