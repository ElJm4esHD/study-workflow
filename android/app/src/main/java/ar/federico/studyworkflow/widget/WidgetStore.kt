package ar.federico.studyworkflow.widget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Copia local de lo último que bajó el servidor, la cola de tildes y las tachadas de 3 s. */
object WidgetStore {
    private fun p(ctx: Context) = ctx.getSharedPreferences("sw_widgets", Context.MODE_PRIVATE)
    private fun JSONObject.str(k: String): String? = if (isNull(k)) null else optString(k)
    private fun JSONArray.objs(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

    private fun toTodo(o: JSONObject) = Todo(
        o.getString("id"), o.optString("title"), o.str("dueDate"), o.str("dueTime"), o.str("materiaId"),
        o.optBoolean("completed"), o.optInt("sortOrder"), o.optString("updatedAt"),
    )
    private fun toEv(o: JSONObject) = Ev(
        o.getString("id"), o.optString("title"), o.optString("kind", "evento"), o.optBoolean("allDay"),
        o.getString("startDate"), o.optString("endDate", o.getString("startDate")), o.str("startTime"), o.str("materiaId"),
    )

    fun server(ctx: Context): String? = p(ctx).getString("server", null)?.takeIf { it.isNotBlank() }
    fun setServer(ctx: Context, url: String?) = p(ctx).edit().putString("server", url?.trimEnd('/')).apply()

    fun todos(ctx: Context): List<Todo>? = p(ctx).getString("todos", null)?.let { JSONArray(it).objs().map(::toTodo) }
    fun agenda(ctx: Context): Pair<List<Ev>, List<Todo>>? = p(ctx).getString("agenda", null)?.let {
        val o = JSONObject(it)
        o.getJSONArray("events").objs().map(::toEv) to o.getJSONArray("todos").objs().map(::toTodo)
    }
    fun mats(ctx: Context): Map<String, Mat> = p(ctx).getString("mats", null)?.let { s ->
        JSONArray(s).objs().associate {
            val c = it.optString("color", "#b6bcc8")
            it.getString("id") to Mat(it.getString("id"), it.optString("sigla"), c, it.optString("colorStrong", c))
        }
    } ?: emptyMap()

    fun savedAt(ctx: Context): Long? = p(ctx).getLong("savedAt", 0).takeIf { it > 0 }
    fun offline(ctx: Context): Boolean = p(ctx).getBoolean("offline", false)
    fun setOffline(ctx: Context, v: Boolean) = p(ctx).edit().putBoolean("offline", v).apply()

    fun queue(ctx: Context): List<QueueOp> = JSONArray(p(ctx).getString("queue", "[]")).objs().map {
        QueueOp(it.getString("id"), it.getBoolean("completed"), it.str("baseUpdatedAt"), it.getString("at"))
    }
    fun setQueue(ctx: Context, q: List<QueueOp>) {
        val a = JSONArray()
        q.forEach { a.put(JSONObject().put("id", it.id).put("completed", it.completed).put("baseUpdatedAt", it.baseUpdatedAt ?: JSONObject.NULL).put("at", it.at)) }
        p(ctx).edit().putString("queue", a.toString()).apply()
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

    /** Cambia `completed` (y `updatedAt` si viene) de ese id en un JSON guardado: array de tareas o {events, todos}. */
    private fun patch(json: String, id: String, completed: Boolean?, updatedAt: String?): String {
        fun fix(a: JSONArray) = a.objs().forEach {
            if (it.optString("id") == id && it.has("completed")) {
                if (completed != null) it.put("completed", completed)
                if (updatedAt != null) it.put("updatedAt", updatedAt)
            }
        }
        return if (json.startsWith("[")) JSONArray(json).also(::fix).toString()
        else JSONObject(json).also { fix(it.getJSONArray("todos")) }.toString()
    }

    /** Saca de la cola el op ya enviado, salvo que el usuario haya vuelto a tocar (otro `at`). */
    @Synchronized
    fun dropOp(ctx: Context, op: QueueOp) = setQueue(ctx, queue(ctx).filterNot { it.id == op.id && it.at == op.at })

    @Synchronized
    fun toggle(ctx: Context, id: String, completed: Boolean) {
        val base = (todos(ctx).orEmpty() + agenda(ctx)?.second.orEmpty()).firstOrNull { it.id == id }?.updatedAt
        setQueue(ctx, enqueueOp(queue(ctx), QueueOp(id, completed, base, java.time.Instant.now().toString())))
        val e = p(ctx).edit()
        for (k in listOf("todos", "agenda")) p(ctx).getString(k, null)?.let { e.putString(k, patch(it, id, completed, null)) }
        val keep = keepMap(ctx)
        if (completed) keep.put(id, System.currentTimeMillis() + 3000) else keep.remove(id)
        e.putString("keep", keep.toString()).apply()
    }

    fun setUpdatedAt(ctx: Context, id: String, updatedAt: String) {
        val e = p(ctx).edit()
        for (k in listOf("todos", "agenda")) p(ctx).getString(k, null)?.let { e.putString(k, patch(it, id, null, updatedAt)) }
        e.apply()
    }

    /** Guarda lo bajado; los tildes todavía en cola ganan sobre lo que dice el servidor. */
    @Synchronized
    fun saveAll(ctx: Context, todoJson: String, agendaJson: String, matsJson: String) {
        var t = todoJson
        var a = agendaJson
        for (op in queue(ctx)) {
            t = patch(t, op.id, op.completed, null)
            a = patch(a, op.id, op.completed, null)
        }
        p(ctx).edit().putString("todos", t).putString("agenda", a).putString("mats", matsJson)
            .putLong("savedAt", System.currentTimeMillis()).apply()
    }
}
