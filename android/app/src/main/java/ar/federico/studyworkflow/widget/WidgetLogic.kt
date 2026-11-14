package ar.federico.studyworkflow.widget

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

data class Todo(
    val id: String, val title: String, val dueDate: String?, val dueTime: String?,
    val materiaId: String?, val completed: Boolean, val sortOrder: Int, val updatedAt: String,
    val subDone: Int = 0, val subTotal: Int = 0, val reminderMin: Int? = null, val insistent: Boolean = false,
)
data class Ev(
    val id: String, val title: String, val kind: String, val allDay: Boolean,
    val startDate: String, val endDate: String, val startTime: String?, val materiaId: String?,
    val reminderMin: Int? = null, val insistent: Boolean = false,
)
data class Mat(val id: String, val sigla: String, val color: String, val colorStrong: String)
data class QueueOp(val id: String, val completed: Boolean, val baseUpdatedAt: String?, val at: String)

private val byDue = compareBy<Todo>({ it.dueDate ?: "9999-99-99" }, { it.dueTime == null }, { it.dueTime ?: "" }, { it.sortOrder })

/** Pendientes por vencimiento; `keep` son las recién tildadas que siguen tachadas unos segundos. */
fun todoList(items: List<Todo>, keep: Set<String>): List<Todo> =
    items.filter { !it.completed || it.id in keep }.sortedWith(byDue)

fun isOverdue(t: Todo, today: String): Boolean = t.dueDate != null && t.dueDate < today

/** Un tilde nuevo de la misma tarea reemplaza al anterior y conserva la base del primero. */
fun enqueueOp(queue: List<QueueOp>, op: QueueOp): List<QueueOp> {
    val prev = queue.find { it.id == op.id } ?: return queue + op
    return queue.map { if (it.id == op.id) op.copy(baseUpdatedAt = prev.baseUpdatedAt) else it }
}

/** Misma regla que flush() en core/web/offline.ts: si desde la compu cambió la tarea, gana el servidor. */
fun shouldSend(op: QueueOp, status: Int, serverUpdatedAt: String?): Boolean {
    if (status == 404 || serverUpdatedAt == null) return false
    val stale = if (op.baseUpdatedAt == null) serverUpdatedAt >= op.at else serverUpdatedAt != op.baseUpdatedAt
    return !stale
}

data class Reminder(val key: String, val at: Long, val title: String, val text: String, val route: String, val insistent: Boolean)

/** Sin hora (tarea con fecha sola o evento de todo el día) la base es las 09:00. */
private fun fireAt(date: String, time: String?, min: Int, zone: ZoneId): Long =
    LocalDate.parse(date).atTime(LocalTime.parse(time ?: "09:00")).atZone(zone).toInstant().toEpochMilli() - min * 60_000L

private fun whenText(date: String, time: String?) = date.substring(8) + "/" + date.substring(5, 7) + (time?.let { " $it" } ?: "")

/** Recordatorios futuros de tareas pendientes y eventos (uno por ocurrencia), los `max` más próximos. */
fun reminders(todos: List<Todo>, events: List<Ev>, nowMs: Long, zone: ZoneId, max: Int = 60): List<Reminder> {
    val t = todos.filter { !it.completed && it.dueDate != null && it.reminderMin != null }.map {
        Reminder("t:${it.id}", fireAt(it.dueDate!!, it.dueTime, it.reminderMin!!, zone), it.title, "Tarea · " + whenText(it.dueDate, it.dueTime), "/todo/${it.id}", it.insistent)
    }
    val e = events.filter { it.reminderMin != null }.map {
        val time = if (it.allDay) null else it.startTime
        Reminder(
            "e:${it.id}", fireAt(it.startDate, time, it.reminderMin!!, zone), it.title,
            it.kind.replaceFirstChar { c -> c.uppercase() } + " · " + whenText(it.startDate, time),
            "/calendario?vista=mes&fecha=${it.startDate}&dia=${it.startDate}", it.insistent,
        )
    }
    return (t + e).filter { it.at > nowMs }.sortedBy { it.at }.take(max)
}
