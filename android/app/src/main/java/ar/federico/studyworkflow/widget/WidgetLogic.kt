package ar.federico.studyworkflow.widget

import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

data class Todo(
    val id: String, val title: String, val dueDate: String?, val dueTime: String?,
    val materiaId: String?, val completed: Boolean, val sortOrder: Int, val updatedAt: String,
)
data class Ev(
    val id: String, val title: String, val kind: String, val allDay: Boolean,
    val startDate: String, val endDate: String, val startTime: String?, val materiaId: String?,
)
data class Mat(val id: String, val sigla: String, val color: String, val colorStrong: String)
data class Day(val date: String, val exams: List<Ev>, val events: List<Ev>, val todos: List<Todo>)
data class QueueOp(val id: String, val completed: Boolean, val baseUpdatedAt: String?, val at: String)

val EXAM_KINDS = setOf("parcial", "recuperatorio", "final")

private val byDue = compareBy<Todo>({ it.dueDate ?: "9999-99-99" }, { it.dueTime == null }, { it.dueTime ?: "" }, { it.sortOrder })

/** Pendientes por vencimiento; `keep` son las recién tildadas que siguen tachadas unos segundos. */
fun todoList(items: List<Todo>, keep: Set<String>): List<Todo> =
    items.filter { !it.completed || it.id in keep }.sortedWith(byDue)

fun isOverdue(t: Todo, today: String): Boolean = t.dueDate != null && t.dueDate < today

fun agendaDays(events: List<Ev>, todos: List<Todo>, today: String, keep: Set<String>): List<Day> {
    val end = LocalDate.parse(today).plusDays(7).toString()
    val dates = generateSequence(LocalDate.parse(today)) { it.plusDays(1) }.takeWhile { it.toString() <= end }.map { it.toString() }
    val visible = todoList(todos, keep)
    val order = compareBy<Ev>({ !it.allDay }, { it.startTime ?: "" })
    return dates.mapNotNull { d ->
        val evs = events.filter { it.startDate <= d && d <= it.endDate }.sortedWith(order)
        val day = Day(d, evs.filter { it.kind in EXAM_KINDS }, evs.filter { it.kind !in EXAM_KINDS }, visible.filter { it.dueDate == d })
        day.takeIf { it.exams.isNotEmpty() || it.events.isNotEmpty() || it.todos.isNotEmpty() }
    }.toList()
}

fun dayLabel(date: String, today: String): String {
    val d = LocalDate.parse(date)
    val name = d.dayOfWeek.getDisplayName(TextStyle.FULL, Locale("es", "AR"))
    val dm = "%02d/%02d".format(d.dayOfMonth, d.monthValue)
    return when (date) {
        today -> "Hoy · $name $dm"
        LocalDate.parse(today).plusDays(1).toString() -> "Mañana · $name $dm"
        else -> name.replaceFirstChar { it.uppercase() } + " $dm"
    }
}

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
