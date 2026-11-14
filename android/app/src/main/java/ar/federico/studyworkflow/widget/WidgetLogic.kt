package ar.federico.studyworkflow.widget

data class Todo(
    val id: String, val title: String, val dueDate: String?, val dueTime: String?,
    val materiaId: String?, val completed: Boolean, val sortOrder: Int, val updatedAt: String,
    val subDone: Int = 0, val subTotal: Int = 0,
)
data class Ev(
    val id: String, val title: String, val kind: String, val allDay: Boolean,
    val startDate: String, val endDate: String, val startTime: String?, val materiaId: String?,
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
