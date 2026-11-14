package ar.federico.studyworkflow.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetLogicTest {
    private fun t(id: String, due: String? = null, time: String? = null, order: Int = 0, done: Boolean = false) =
        Todo(id, id, due, time, null, done, order, "u")

    @Test fun todoList_ordena() {
        val items = listOf(
            t("fut", "2026-11-10"), t("nofecha", order = 5), t("s1", "2026-11-06", order = 1),
            t("s0", "2026-11-06", order = 0), t("h10", "2026-11-06", "10:00"), t("venc", "2026-11-03"),
            t("hecha", "2026-11-06", done = true),
        )
        assertEquals(listOf("venc", "h10", "s0", "s1", "fut", "nofecha"), todoList(items, emptySet()).map { it.id })
        assertTrue(todoList(items, setOf("hecha")).any { it.id == "hecha" })
    }

    @Test fun enqueueOp_colapsa() {
        val q = enqueueOp(listOf(QueueOp("a", true, "u1", "t1")), QueueOp("a", false, "u2", "t2"))
        assertEquals(listOf(QueueOp("a", false, "u1", "t2")), q)
    }

    @Test fun shouldSend_regla() {
        assertFalse(shouldSend(QueueOp("a", true, "u1", "t"), 404, "x"))
        assertTrue(shouldSend(QueueOp("a", true, "u1", "t"), 200, "u1"))
        assertFalse(shouldSend(QueueOp("a", true, "u1", "t"), 200, "u2"))
        assertTrue(shouldSend(QueueOp("a", true, null, "2026-11-06T10:00:00Z"), 200, "2026-11-06T09:00:00Z"))
    }
}
