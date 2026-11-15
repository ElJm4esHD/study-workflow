import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { httpError } from './errors.ts';
import type { CoreContext, ServerModule, SearchHit } from './registry.ts';

/** Backup completo en JSON (todas las tablas, sin conocer los módulos) y búsqueda global (la responden los módulos). */

const FORMAT = 'study-workflow-backup';
type Rows = Record<string, Record<string, unknown>[]>;
type Backup = { format: typeof FORMAT; version: 1; exportedAt: string; schema: { module: string; version: string }[]; tables: Rows };

const tableNames = (ctx: CoreContext) =>
  (ctx.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'migrations' ORDER BY name").all() as { name: string }[]).map((r) => r.name);
const schema = (ctx: CoreContext) => ctx.db.prepare('SELECT module, version FROM migrations ORDER BY module, version').all() as { module: string; version: string }[];

export function exportBackup(ctx: CoreContext): Backup {
  const tables: Rows = {};
  for (const t of tableNames(ctx)) tables[t] = ctx.db.prepare(`SELECT * FROM "${t}"`).all() as Record<string, unknown>[];
  return { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), schema: schema(ctx), tables };
}

const bad = (msg: string) => httpError(400, 'backup_invalido', msg);

/** Reemplaza TODO lo que hay por el contenido del backup, en una sola transacción: si algo falla no cambia nada. */
export function importBackup(ctx: CoreContext, b: unknown): { tablas: number; filas: number } {
  const x = b as Partial<Backup> | null;
  if (!x || x.format !== FORMAT || x.version !== 1 || typeof x.tables !== 'object' || x.tables === null) throw bad('Ese archivo no es un backup de Study Workflow.');
  const known = new Set(tableNames(ctx));
  const mine = new Set(schema(ctx).map((s) => `${s.module}/${s.version}`));
  for (const s of x.schema ?? []) if (!mine.has(`${s.module}/${s.version}`)) throw bad('El backup es de una versión más nueva de la app. Actualizá el servidor y probá de nuevo.');
  const plan: [string, Record<string, unknown>[], string[]][] = [];
  for (const [t, rows] of Object.entries(x.tables)) {
    if (!known.has(t)) throw bad(`El backup tiene datos que esta versión no conoce (${t}).`);
    if (!Array.isArray(rows)) throw bad('El archivo está dañado.');
    const cols = new Set((ctx.db.prepare(`PRAGMA table_info("${t}")`).all() as { name: string }[]).map((c) => c.name));
    for (const r of rows) for (const k of Object.keys(r)) if (!cols.has(k)) throw bad(`El backup tiene un campo que esta versión no conoce (${t}.${k}).`);
    plan.push([t, rows, [...cols]]);
  }
  let filas = 0;
  try {
    ctx.transaction(() => {
      ctx.db.exec('PRAGMA defer_foreign_keys = ON'); // el orden de borrado e inserción no importa: se revisa al confirmar
      for (const t of known) ctx.db.exec(`DELETE FROM "${t}"`);
      for (const [t, rows] of plan) {
        for (const r of rows) {
          const keys = Object.keys(r);
          ctx.db.prepare(`INSERT INTO "${t}" (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
            .run(...keys.map((k) => r[k] as string | number | null));
          filas++;
        }
      }
    });
  } catch {
    throw bad('No se pudo restaurar el backup: tiene datos inconsistentes. No se cambió nada.');
  }
  return { tablas: plan.length, filas };
}

export function registerData(app: FastifyInstance, ctx: CoreContext, mods: ServerModule[], dbPath: string): void {
  app.get('/api/backup', async (_req, reply) => {
    const day = new Date().toISOString().slice(0, 10);
    return reply.header('Content-Disposition', `attachment; filename="study-workflow-${day}.json"`).type('application/json').send(exportBackup(ctx));
  });
  app.post('/api/backup', { bodyLimit: 50 * 1024 * 1024, schema: { body: { type: 'object' } } }, async (req) => {
    // Red de seguridad: antes de pisar todo queda una copia del estado actual junto a la base.
    if (dbPath !== ':memory:') {
      const dir = join(dirname(dbPath), 'backups');
      mkdirSync(dir, { recursive: true });
      ctx.db.prepare('VACUUM INTO ?').run(join(dir, `pre-import-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`));
    }
    return importBackup(ctx, req.body);
  });

  app.get('/api/search', async (req) => {
    const q = String((req.query as { q?: string }).q ?? '').trim();
    if (q.length < 2) return [];
    const hits: SearchHit[] = [];
    for (const m of mods) if (m.search && ctx.modules.isEnabled(m.id)) hits.push(...m.search(ctx, q));
    return hits.slice(0, 40);
  });
}
