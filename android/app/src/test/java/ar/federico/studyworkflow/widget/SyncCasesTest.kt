package ar.federico.studyworkflow.widget

import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Almacén en memoria con las mismas reglas que SqlStore (solo se guarda si el HLC no es menor). */
class MemStore(rows: List<Row> = emptyList(), meta: Map<String, String> = emptyMap()) : RecStore {
    val rows = LinkedHashMap<String, Row>().also { m -> rows.forEach { m["${it.t}\u0000${it.id}"] = it } }
    val meta = meta.toMutableMap()
    override fun get(t: String, id: String) = rows["$t\u0000$id"]
    override fun all() = rows.values.toList()
    override fun dirty() = rows.values.filter { it.dirty }
    override fun put(rows: List<Row>) { for (r in rows) { val cur = get(r.t, r.id); if (cur == null || cur.hlc <= r.hlc) this.rows["${r.t}\u0000${r.id}"] = r } }
    override fun delete(keys: List<Pair<String, String>>) { keys.forEach { rows.remove("${it.first}\u0000${it.second}") } }
    override fun meta(k: String) = meta[k]
    override fun setMeta(k: String, v: String) { meta[k] = v }
    override fun <T> tx(fn: () -> T) = fn()
}

/** Corre core/shared/sync-cases.json: los mismos casos que cases.test.ts corre contra el motor de TypeScript. */
class SyncCasesTest {
    private val cases = JSONObject(File("../../core/shared/sync-cases.json").readText())

    private fun JSONArray.objs() = (0 until length()).map { getJSONObject(it) }
    private fun JSONArray.strs() = (0 until length()).map { getString(it) }
    private fun row(o: JSONObject) = Row(o.getString("t"), o.getString("id"), if (o.isNull("data")) null else o.get("data").toString(), o.getString("hlc"), o.optInt("dirty") == 1)
    /** Se compara el JSON normalizado (el orden de las claves no importa). */
    private fun norm(r: Row) = listOf(r.t, r.id, r.data?.let { JSONObject(it).toString(2) }, r.hlc, r.dirty).toString()
    private fun sorted(rows: Collection<Row>) = rows.sortedBy { it.t + it.id }.map(::norm)

    @Test fun hlc() {
        for (c in cases.getJSONArray("hlc").objs()) {
            var now = 0L
            val clock = Hlc(c.getString("node")) { now }
            for (s in c.getJSONArray("steps").objs()) {
                now = s.getLong("now")
                if (s.getString("op") == "tick") assertEquals(c.getString("name"), s.getString("expect"), clock.tick()) else clock.recv(s.getString("hlc"))
            }
        }
    }

    @Test fun merge() {
        for (c in cases.getJSONArray("merge").objs()) {
            val store = MemStore(c.getJSONArray("local").objs().map(::row))
            val remote = c.getJSONArray("remote").objs().map(::row)
            assertEquals(c.getString("name"), c.getInt("expectChanged"), SyncCore.merge(store, Hlc("dev") { 0 }, remote))
            assertEquals(c.getString("name"), sorted(c.getJSONArray("expect").objs().map(::row)), sorted(store.rows.values))
        }
    }

    @Test fun flow() {
        for (c in cases.getJSONArray("flow").objs()) {
            val name = c.getString("name")
            val meta = c.getJSONObject("meta").let { m -> m.keys().asSequence().associateWith { m.getString(it) } }
            val store = MemStore(c.getJSONArray("local").objs().map(::row), meta)
            val pages = ArrayDeque(c.getJSONArray("pages").objs())
            val pulls = mutableListOf<String?>()
            val pushed = mutableListOf<String>()
            val target = object : Target {
                override fun push(records: List<Row>) { records.forEach { pushed.add("${it.t}/${it.id}@${it.hlc}") } }
                override fun pull(cursor: String?): Page {
                    pulls.add(cursor)
                    val p = pages.removeFirst()
                    return Page(p.getJSONArray("records").objs().map(::row), p.getString("cursor"), p.getBoolean("more"), if (p.has("reset")) p.getString("reset") else null)
                }
            }
            val now = c.getLong("now")
            SyncCore.sync(store, Hlc(c.getString("node")) { now }, target, now)
            assertEquals(name, c.getJSONArray("expectPulls").let { a -> (0 until a.length()).map { if (a.isNull(it)) null else a.getString(it) } }, pulls)
            assertEquals(name, c.getJSONArray("expectPushed").strs().sorted(), pushed.sorted())
            assertEquals(name, sorted(c.getJSONArray("expectRows").objs().map(::row)), sorted(store.rows.values))
            assertEquals(name, c.getString("expectCursor"), store.meta["cursor"])
        }
    }

    @Test fun series() {
        for (c in cases.getJSONArray("series").objs()) {
            val e = c.getJSONObject("event")
            val wd = e.getJSONArray("repeatWeekdays").let { a -> (0 until a.length()).map { a.getInt(it) } }
            val until = if (e.isNull("repeatUntil")) null else e.getString("repeatUntil")
            val ex = c.getJSONArray("exdates").strs().toSet()
            assertEquals(c.getString("name"), c.getJSONArray("expect").strs(), seriesDates(e.getString("startDate"), wd, until, c.getString("from"), c.getString("to"), ex))
        }
    }

    @Test fun tildar_desde_el_widget_usa_la_misma_regla_que_la_app() {
        val doc = """{"id":"a","title":"T","completed":false,"completedAt":null,"updatedAt":"antes","subtasks":[{"id":"s","title":"x","done":false}]}"""
        val store = MemStore(listOf(Row("todo_items", "a", doc, "0000000000001-0000-dev", false)))
        val clock = Hlc("dev-w") { 5000 }
        assertTrue(SyncCore.setCompleted(store, clock, "a", true, "2026-11-15T10:00:00.000Z"))
        val r = store.get("todo_items", "a")!!
        val d = JSONObject(r.data!!)
        assertTrue(d.getBoolean("completed"))
        assertEquals("2026-11-15T10:00:00.000Z", d.getString("completedAt"))
        assertEquals("2026-11-15T10:00:00.000Z", d.getString("updatedAt"))
        assertEquals(1, d.getJSONArray("subtasks").length()) // las subtareas no se tocan
        assertTrue(r.dirty)
        assertEquals("0000000005000-0000-dev-w", r.hlc)
        // tildar de nuevo conserva el completedAt original; destildar lo limpia
        SyncCore.setCompleted(store, clock, "a", true, "2026-11-15T11:00:00.000Z")
        assertEquals("2026-11-15T10:00:00.000Z", JSONObject(store.get("todo_items", "a")!!.data!!).getString("completedAt"))
        SyncCore.setCompleted(store, clock, "a", false, "2026-11-15T12:00:00.000Z")
        assertTrue(JSONObject(store.get("todo_items", "a")!!.data!!).isNull("completedAt"))
        assertFalse(SyncCore.setCompleted(store, clock, "no-existe", true, "x"))
        assertNotNull(store.get("todo_items", "a"))
    }
}
