package ar.federico.studyworkflow.widget

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

/**
 * Base local del dispositivo (sw.db): la usan la app (por el plugin), el widget, los recordatorios y el sync de fondo.
 * Un solo helper por proceso, con WAL: las escrituras van en transacciones cortas.
 */
class SwDb private constructor(ctx: Context) : SQLiteOpenHelper(ctx.applicationContext, "sw.db", null, 1) {
    override fun onConfigure(db: SQLiteDatabase) { db.enableWriteAheadLogging() }
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE records (t TEXT NOT NULL, id TEXT NOT NULL, data TEXT, hlc TEXT NOT NULL, dirty INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (t, id))")
        db.execSQL("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    }
    override fun onUpgrade(db: SQLiteDatabase, old: Int, new: Int) {}

    companion object {
        @Volatile private var inst: SwDb? = null
        fun get(ctx: Context): SwDb = inst ?: synchronized(this) { inst ?: SwDb(ctx).also { inst = it } }

        /** Lo pone el plugin mientras la app está abierta: avisa que el widget o el sync de fondo escribieron. */
        @Volatile var onNativeWrite: (() -> Unit)? = null
    }
}

/** RecStore sobre SwDb. `notify`: avisar a la app abierta de lo escrito (no para lo que escribe la propia app). */
class SqlStore(private val h: SwDb, private val notify: Boolean = true) : RecStore {
    private fun row(c: android.database.Cursor) = Row(c.getString(0), c.getString(1), c.getString(2), c.getString(3), c.getInt(4) == 1)
    private fun query(where: String?, vararg args: String): List<Row> =
        h.readableDatabase.rawQuery("SELECT t, id, data, hlc, dirty FROM records" + (where?.let { " WHERE $it" } ?: ""), args).use { c ->
            buildList { while (c.moveToNext()) add(row(c)) }
        }

    override fun get(t: String, id: String) = query("t = ? AND id = ?", t, id).firstOrNull()
    override fun all() = query(null)
    override fun dirty() = query("dirty = 1")

    override fun put(rows: List<Row>) {
        val db = h.writableDatabase
        db.beginTransaction()
        try {
            for (r in rows) {
                // INSERT OR REPLACE solo si el HLC es mayor o igual (el upsert de SQLite no está en Android < 11).
                val cur = db.rawQuery("SELECT hlc FROM records WHERE t = ? AND id = ?", arrayOf(r.t, r.id)).use { if (it.moveToFirst()) it.getString(0) else null }
                if (cur != null && cur > r.hlc) continue
                db.replace("records", null, ContentValues().apply { put("t", r.t); put("id", r.id); put("data", r.data); put("hlc", r.hlc); put("dirty", if (r.dirty) 1 else 0) })
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
        if (notify && rows.isNotEmpty()) SwDb.onNativeWrite?.invoke()
    }

    override fun delete(keys: List<Pair<String, String>>) {
        val db = h.writableDatabase
        db.beginTransaction()
        try {
            keys.forEach { (t, id) -> db.delete("records", "t = ? AND id = ?", arrayOf(t, id)) }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }

    override fun meta(k: String): String? = h.readableDatabase.rawQuery("SELECT value FROM meta WHERE key = ?", arrayOf(k)).use { if (it.moveToFirst()) it.getString(0) else null }
    override fun setMeta(k: String, v: String) { h.writableDatabase.replace("meta", null, ContentValues().apply { put("key", k); put("value", v) }) }

    // La anidación de transacciones de SQLite de Android alcanza para agrupar (put/delete abren la suya).
    override fun <T> tx(fn: () -> T): T {
        val db = h.writableDatabase
        db.beginTransaction()
        try { return fn().also { db.setTransactionSuccessful() } } finally { db.endTransaction() }
    }

    /** Documentos vivos de una colección, ya parseados. */
    fun docs(t: String): List<JSONObject> = query("t = ? AND data IS NOT NULL", t).map { JSONObject(it.data!!) }

    /** Todas las filas, para que la app arranque con una sola lectura. */
    fun load(): Pair<List<Row>, Map<String, String>> {
        val meta = h.readableDatabase.rawQuery("SELECT key, value FROM meta", null).use { c -> buildMap { while (c.moveToNext()) put(c.getString(0), c.getString(1)) } }
        return all() to meta
    }

    fun maxHlc(): String? = h.readableDatabase.rawQuery("SELECT MAX(hlc) FROM records", null).use { if (it.moveToFirst()) it.getString(0) else null }

    /** El reloj del lado nativo: nodo `<dispositivo>-w` (distinto del de la app), por encima de todo lo que ya hay. */
    fun clock(): Hlc {
        val dev = meta("deviceId") ?: java.util.UUID.randomUUID().toString().take(6).replace(Regex("[^0-9a-f]"), "a").also { setMeta("deviceId", it) }
        return Hlc("$dev-w").also { c -> maxHlc()?.let(c::recv) }
    }
}
