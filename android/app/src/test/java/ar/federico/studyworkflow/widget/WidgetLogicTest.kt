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

    @Test fun reminders_calcula() {
        val zone = java.time.ZoneId.of("America/Argentina/Buenos_Aires")
        fun ms(iso: String) = java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli()
        val todos = listOf(
            Todo("a", "A", "2026-11-20", "18:00", null, false, 0, "u", reminderMin = 15, insistent = true),
            Todo("sinhora", "B", "2026-11-21", null, null, false, 0, "u", reminderMin = 0),
            Todo("hecha", "C", "2026-11-20", "18:00", null, true, 0, "u", reminderMin = 15),
            Todo("sinrec", "D", "2026-11-20", "18:00", null, false, 0, "u"),
            Todo("pasada", "E", "2026-11-10", "18:00", null, false, 0, "u", reminderMin = 0),
        )
        val events = listOf(
            Ev("s:2026-11-23", "Clase", "evento", false, "2026-11-23", "2026-11-23", "10:00", null, reminderMin = 60),
            Ev("s:2026-11-25", "Clase", "evento", false, "2026-11-25", "2026-11-25", "10:00", null, reminderMin = 60),
            Ev("f", "Final", "final", true, "2026-11-22", "2026-11-22", null, null, reminderMin = 1440),
        )
        val r = reminders(todos, events, ms("2026-11-14T12:00:00-03:00"), zone)
        assertEquals(listOf("t:a", "t:sinhora", "f", "s:2026-11-23", "s:2026-11-25").map { if (it.startsWith("t:")) it else "e:$it" }, r.map { it.key })
        assertEquals(ms("2026-11-20T17:45:00-03:00"), r[0].at)
        assertTrue(r[0].insistent)
        assertEquals(ms("2026-11-21T09:00:00-03:00"), r[1].at) // sin hora: 09:00
        assertEquals(ms("2026-11-21T09:00:00-03:00"), r[2].at) // todo el día: 09:00 del 22, menos 1 día
        assertEquals("/todo/a", r[0].route)
        assertEquals(2, reminders(todos, events, ms("2026-11-14T12:00:00-03:00"), zone, max = 2).size)
    }
}
