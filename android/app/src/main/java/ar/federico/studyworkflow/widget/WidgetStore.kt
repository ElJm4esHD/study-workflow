package ar.federico.studyworkflow.widget

import android.content.Context
import java.time.LocalDate
import org.json.JSONArray
import org.json.JSONObject

/**
 * Lo que el widget y los recordatorios leen: los datos salen de la base del dispositivo (SwDb, la misma que usa la app);
 * acá quedan solo las preferencias de este celu (servidor, acento, tema) y las tachadas de 3 s.
 */
object WidgetStore {
    private fun p(ctx: Context) = ctx.getSharedPreferences("sw_widgets", Context.MODE_PRIVATE)
    private fun JSONObject.str(k: String): String? = if (isNull(k)) null else optString(k)
    private fun JSONObject.int(k: String): Int? = if (isNull(k)) null else optInt(k)
    private fun JSONArray.objs(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

    private fun toTodo(o: JSONObject) = Todo(
        o.getString("id"), o.optString("title"), o.str("dueDate"), o.str("dueTime"), o.str("materiaId"),
        o.optBoolean("completed"), o.optInt("sortOrder"), o.optString("updatedAt"),
        o.optJSONArray("subtasks")?.objs()?.count { it.optBoolean("done") } ?: 0, o.optJSONArray("subtasks")?.length() ?: 0,
        o.int("reminderMin"), o.optBoolean("reminderInsistent"),
    )

    private fun store(ctx: Context) = SqlStore(SwDb.get(ctx))

    fun server(ctx: Context): String? = p(ctx).getString("server", null)?.takeIf { it.isNotBlank() }
    /** Color de acento elegido en la app (Ajustes › Apariencia); el widget lo usa en el contador y el botón +. */
    fun accent(ctx: Context): Int = runCatching { android.graphics.Color.parseColor(p(ctx).getString("accent", null)) }.getOrDefault(0xFFB7C4FF.toInt())
    fun accentLight(ctx: Context): Int = runCatching { android.graphics.Color.parseColor(p(ctx).getString("accentLight", null)) }.getOrDefault(0xFF3E50C4.toInt())
    fun setAccent(ctx: Context, hex: String, light: String?) = p(ctx).edit().putString("accent", hex).putString("accentLight", light).apply()
    /** Tema elegido en la app: "dark", "light" o "system". */
    fun theme(ctx: Context): String = p(ctx).getString("theme", null) ?: "dark"
    fun setTheme(ctx: Context, mode: String) = p(ctx).edit().putString("theme", mode).apply()
    fun setServer(ctx: Context, url: String?) = p(ctx).edit().putString("server", url?.trimEnd('/')).apply()

    fun todos(ctx: Context): List<Todo> = store(ctx).docs("todo_items").map(::toTodo)

    /** Eventos de hoy a `days` días; una serie se expande en una ocurrencia por fecha (id "<serie>:<fecha>"). */
    fun events(ctx: Context, from: LocalDate, days: Long = 30): List<Ev> {
        val to = from.plusDays(days)
        return store(ctx).docs("calendar_events").flatMap { e ->
            val id = e.getString("id")
            val start = e.getString("startDate")
            val wd = e.optJSONArray("repeatWeekdays")
            fun ev(date: String, key: String) = Ev(
                key, e.optString("title"), e.optString("kind", "evento"), e.optBoolean("allDay"), date, date, e.str("startTime"), e.str("materiaId"),
                e.int("reminderMin"), e.optBoolean("reminderInsistent"),
            )
            if (wd == null || e.isNull("repeatWeekdays")) listOf(ev(start, id).copy(endDate = e.optString("endDate", start)))
            else {
                val ex = e.optJSONArray("exdates")?.let { a -> (0 until a.length()).map { a.getString(it) }.toSet() }.orEmpty()
                seriesDates(start, (0 until wd.length()).map { wd.getInt(it) }, e.str("repeatUntil"), from.toString(), to.toString(), ex).map { ev(it, "$id:$it") }
            }
        }
    }

    fun mats(ctx: Context): Map<String, Mat> = store(ctx).docs("materias").associate {
        val c = it.optString("color", "#b6bcc8")
        it.getString("id") to Mat(it.getString("id"), it.optString("sigla"), c, it.optString("colorStrong", c))
    }

    /** Cambios del dispositivo todavía sin subir al servidor. */
    fun queued(ctx: Context): Int = store(ctx).dirty().size
    /** Última vez que se sincronizó con el servidor (la app o el sync de fondo). */
    fun savedAt(ctx: Context): Long? = store(ctx).meta("lastSync")?.let { runCatching { java.time.Instant.parse(it).toEpochMilli() }.getOrNull() }
    /** El último sync de fondo no pudo conectar. */
    fun offline(ctx: Context): Boolean = p(ctx).getBoolean("offline", false)
    fun setOffline(ctx: Context, v: Boolean) = p(ctx).edit().putBoolean("offline", v).apply()

    /** Tilda o destilda desde el widget, directo en la base del dispositivo, y deja la tachada 3 s. */
    fun toggle(ctx: Context, id: String, completed: Boolean) {
        val db = SwDb.get(ctx)
        val s = SqlStore(db)
        SyncCore.setCompleted(s, s.clock(), id, completed, SyncCore.nowIso())
        val keep = keepMap(ctx)
        if (completed) keep.put(id, System.currentTimeMillis() + 3000) else keep.remove(id)
        p(ctx).edit().putString("keep", keep.toString()).apply()
    }

    private fun keepMap(ctx: Context) = JSONObject(p(ctx).getString("keep", "{}"))
    fun keep(ctx: Context): Set<String> {
        val now = System.currentTimeMillis()
        val m = keepMap(ctx)
        return m.keys().asSequence().filter { m.getLong(it) > now }.toSet()
    }
    fun nextKeepExpiry(ctx: Context): Long? {
        val now = System.currentTimeMillis()
        val m = keepMap(ctx)
        return m.keys().asSequence().map { m.getLong(it) }.filter { it > now }.minOrNull()
    }
}
