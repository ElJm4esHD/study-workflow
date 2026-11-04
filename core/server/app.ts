import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { registerAuth } from './auth.ts';
import { openDb } from './db.ts';
import { HttpError } from './errors.ts';
import { makeMaterias } from './materias.ts';
import { runMigrations } from './migrate.ts';
import { makeSettings } from './settings.ts';
import { orderModules, type CoreContext, type ServerModule } from './registry.ts';

const body = (code: string, message: string) => ({ error: { code, message } });

export async function buildApp(opts: { dbPath: string; modules: ServerModule[]; webDist?: string }):
  Promise<FastifyInstance & { ctx: CoreContext }> {
  const mods = orderModules(opts.modules);
  const db = openDb(opts.dbPath);
  runMigrations(db, [
    { module: 'core', dir: new URL('./migrations/', import.meta.url) },
    ...mods.map((m) => ({ module: m.id, dir: m.migrationsDir })),
  ]);

  const settings = makeSettings(db);
  const services = new Map<string, object>();
  const ctx: CoreContext = {
    db,
    transaction<T>(fn: () => T): T {
      db.exec('BEGIN IMMEDIATE');
      try {
        const r = fn();
        db.exec('COMMIT');
        return r;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    materias: makeMaterias(db),
    settings,
    modules: { isEnabled: (id) => settings.get<Record<string, boolean>>('modules.enabled', {})[id] ?? true },
    services: { get: <T>(id: string) => services.get(id) as T | undefined },
  };
  for (const m of mods) if (m.service) services.set(m.id, m.service(ctx));

  const app = Fastify({ logger: !process.env.VITEST });
  registerAuth(app);

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown[] }, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send(body(err.code, err.message));
    if (err.validation) {
      const v = err.validation[0] as { instancePath?: string; params?: { missingProperty?: string } } | undefined;
      const field = v?.params?.missingProperty ?? v?.instancePath?.replace(/^\//, '');
      return reply.status(400).send(body('validacion', field ? `Datos inválidos: ${field}.` : 'Datos inválidos.'));
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send(body('solicitud_invalida', 'Solicitud inválida.'));
    }
    req.log.error(err);
    return reply.status(500).send(body('error_interno', 'Error interno del servidor.'));
  });

  app.get('/api/materias', async () => ctx.materias.list());
  app.post('/api/materias', {
    schema: { body: { type: 'object', required: ['name', 'color'], properties: {
      id: { type: 'string', minLength: 1 }, name: { type: 'string' }, color: { type: 'string' } } } },
  }, async (req, reply) => reply.status(201).send(ctx.materias.create(req.body as { id?: string; name: string; color: string })));
  app.patch('/api/materias/:id', {
    schema: { body: { type: 'object', properties: {
      name: { type: 'string' }, color: { type: 'string' }, archived: { type: 'boolean' } } } },
  }, async (req) => ctx.materias.update((req.params as { id: string }).id, req.body as object));
  app.get('/api/settings', async () => ctx.settings.getAll());
  app.patch('/api/settings', { schema: { body: { type: 'object' } } }, async (req) => {
    ctx.transaction(() => { for (const [k, v] of Object.entries(req.body as object)) ctx.settings.set(k, v); });
    return ctx.settings.getAll();
  });

  app.get('/api/health', async () => ({ ok: true, version: process.env.APP_VERSION ?? 'dev' }));
  for (const m of mods) await app.register((a) => m.routes(a, ctx), { prefix: `/api/${m.id}` });

  const webDist = opts.webDist;
  if (webDist) await app.register(fastifyStatic, { root: webDist });
  app.setNotFoundHandler((req, reply) => {
    if (webDist && req.method === 'GET' && !req.url.startsWith('/api')) return reply.sendFile('index.html');
    return reply.status(404).send(body('no_encontrado', 'No encontrado.'));
  });

  app.addHook('onClose', async () => { db.close(); });
  return Object.assign(app, { ctx }) as unknown as FastifyInstance & { ctx: CoreContext };
}
