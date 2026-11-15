package ar.federico.studyworkflow.widget

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.time.LocalDate
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** Con SQLite de verdad (en el celu): lo que el widget y los recordatorios leen de la base del dispositivo. */
@RunWith(AndroidJUnit4::class)
class WidgetStoreInstrumentedTest {
    private val ctx = InstrumentationRegistry.getInstrumentation().targetContext
    private val db = SwDb.get(ctx)
    private val store = SqlStore(db, notify = false)

    @Before fun limpiar() {
        store.delete(store.all().map { it.t to it.id })
    }

    private fun todo(id: String, due: String?, done: Boolean = false, rem: Int? = null, subs: String = "[]") =
        Row("todo_items", id, """{"id":"$id","title":"T $id","dueDate":${due?.let { "\"$it\"" }},"dueTime":null,"materiaId":"m","completed":$done,"completedAt":null,"sortOrder":1,"updatedAt":"u","subtasks":$subs,"reminderMin":$rem,"reminderInsistent":false}""", "0000000000001-0000-x", false)

    @Test fun lee_tareas_materias_y_eventos_de_la_base() {
        store.put(listOf(
            todo("a", "2026-11-20", subs = """[{"id":"s","title":"x","done":true},{"id":"t","title":"y","done":false}]"""),
            Row("materias", "m", """{"id":"m","sigla":"MAT","color":"#9fc3f7","colorStrong":"#3b6fd4"}""", "0000000000001-0000-x", false),
            Row("calendar_events", "e", """{"id":"e","title":"Clase","kind":"evento","allDay":false,"startDate":"2026-11-16","endDate":"2026-11-16","startTime":"10:00","materiaId":"m","repeatWeekdays":[1,3],"repeatUntil":null,"reminderMin":30,"exdates":["2026-11-18"]}""", "0000000000001-0000-x", false),
            Row("todo_items", "borrada", null, "0000000000002-0000-x", false),
        ))
        val t = WidgetStore.todos(ctx)
        assertEquals(listOf("a"), t.map { it.id }) // la marca de borrado no cuenta
        assertEquals(1, t[0].subDone); assertEquals(2, t[0].subTotal)
        assertEquals("MAT", WidgetStore.mats(ctx)["m"]!!.sigla)
        // lunes 16 y miércoles 18 (excluido) → lunes 23 queda; 30 días desde el 16
        val ev = WidgetStore.events(ctx, LocalDate.parse("2026-11-16"), 8).map { it.startDate }
        assertEquals(listOf("2026-11-16", "2026-11-23"), ev)
        assertEquals(0, WidgetStore.queued(ctx))
    }

    @Test fun tildar_desde_el_widget_queda_sin_subir_y_con_hlc_nuevo() {
        store.put(listOf(todo("a", "2026-11-20")))
        WidgetStore.toggle(ctx, "a", true)
        val r = store.get("todo_items", "a")!!
        assertTrue(r.dirty)
        assertTrue(r.hlc > "0000000000001-0000-x")
        assertTrue(r.hlc.endsWith("-w"))
        assertTrue(JSONObject(r.data!!).getBoolean("completed"))
        assertEquals(1, WidgetStore.queued(ctx))
        assertTrue("a" in WidgetStore.keep(ctx))
        // una escritura con HLC menor (la app con datos viejos) no pisa el tilde
        store.put(listOf(todo("a", "2026-11-20", done = false)))
        assertTrue(JSONObject(store.get("todo_items", "a")!!.data!!).getBoolean("completed"))
    }

    @Test fun snapshot_y_recordatorios_no_fallan_con_datos_reales() {
        store.put(listOf(todo("a", LocalDate.now().plusDays(2).toString(), rem = 10)))
        val s = snapshot(ctx)
        assertNotNull(s)
        assertEquals(1, s!!.todos!!.size)
        ReminderScheduler.reschedule(ctx)
        assertFalse(store.dirty().isNotEmpty())
    }
}
