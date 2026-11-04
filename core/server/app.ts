import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { registerAuth } from './auth.ts';
import { openDb } from './db.ts';
import { HttpError } from './errors.ts';
import { runMigrations } from './migrate.ts';
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
    materias: {},
    settings: {},
    modules: { isEnabled: () => true }, // Task 3 lo conecta a settings
    services: { get: <T>(id: string) => services.get(id) as T | undefined },
  };
  for (const m of mods) if (m.service) services.set(m.id, m.service(ctx));

  const app = Fastify({ logger: !process.env.VITEST });
  registerAuth(app);

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send(body(err.code, err.message));
    if (err.validation) return reply.status(400).send(body('validacion', err.message));
    if (err.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send(body('solicitud_invalida', err.message));
    }
    req.log.error(err);
    return reply.status(500).send(body('error_interno', 'Error interno del servidor.'));
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
