-- Destino de sincronización "Mi servidor": registros opacos {t, id, data, hlc}; el server no conoce módulos ni reglas.
CREATE TABLE sync_records (t TEXT NOT NULL, id TEXT NOT NULL, data TEXT, hlc TEXT NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY (t, id));
CREATE INDEX sync_records_seq ON sync_records (seq);
CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); -- epoch, seq (contador), purged (mayor seq limpiado)
