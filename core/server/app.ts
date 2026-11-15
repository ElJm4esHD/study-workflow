import { readFileSync } from 'node:fs';
import { constants, createBrotliCompress, createGzip } from 'node:zlib';
import { Readable } from 'node:stream';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { registerAuth } from './auth.ts';
import { registerCors } from './cors.ts';
import { openDb } from './db.ts';
import { HttpError } from './errors.ts';
import { backfillSiglas, makeMaterias } from './materias.ts';
import { runMigrations } from './migrate.ts';
import { makeSettings } from './settings.ts';
import { registerData } from './data.ts';
import { orderModules, type CoreContext, type ServerModule } from './registry.ts';

const VERSION: string = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

const body = (code: string, message: string) => ({ error: { code, message } });

export async function buildApp(opts: { dbPath: string; modules: ServerModule[]; webDist?: string }):
  Promise<FastifyInstance & { ctx: CoreContext }> {
  const mods = orderModules(opts.modules);
  const db = openDb(opts.dbPath);
  runMigrations(db, [
    { module: 'core', dir: new URL('./migrations/', import.meta.url) },
    ...mods.map((m) => ({ module: m.id, dir: m.migrationsDir })),
  ]);
  backfillSiglas(db);

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
  registerCors(app, ['https://localhost']);
  registerAuth(app);
  // Compresión (br o gzip) de texto, JS, CSS y JSON: el bundle baja de ~680 KB a ~200 KB. Con el zlib de Node, sin dependencias.
  app.addHook('onSend', async (req, reply, payload) => {
    const type = String(reply.getHeader('content-type') ?? '');
    const ae = String(req.headers['accept-encoding'] ?? '');
    const enc = ae.split(',').some((x) => x.trim().startsWith('br')) ? 'br' : ae.split(',').some((x) => x.trim().startsWith('gzip')) ? 'gzip' : null;
    if (!enc || payload == null || reply.statusCode !== 200 || reply.getHeader('content-encoding') || !['text/', 'application/json', 'application/javascript', 'image/svg'].some((t) => type.startsWith(t))) return payload;
    reply.header('Content-Encoding', enc).header('Vary', 'Accept-Encoding').removeHeader('content-length');
    const src = payload instanceof Readable ? payload : Readable.from([Buffer.from(payload as string | Buffer)]);
    return src.pipe(enc === 'br' ? createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }) : createGzip());
  });

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
      id: { type: 'string', minLength: 1 }, name: { type: 'string' }, color: { type: 'string' }, sigla: { type: 'string' } } } },
  }, async (req, reply) => reply.status(201).send(ctx.materias.create(req.body as { id?: string; name: string; color: string; sigla?: string })));
  app.patch('/api/materias/:id', {
    schema: { body: { type: 'object', properties: {
      name: { type: 'string' }, color: { type: 'string' }, sigla: { type: 'string' }, archived: { type: 'boolean' } } } },
  }, async (req) => ctx.materias.update((req.params as { id: string }).id, req.body as object));
  app.get('/api/settings', async () => ctx.settings.getAll());
  app.patch('/api/settings', { schema: { body: { type: 'object' } } }, async (req) => {
    ctx.transaction(() => { for (const [k, v] of Object.entries(req.body as object)) ctx.settings.set(k, v); });
    return ctx.settings.getAll();
  });

  registerData(app, ctx, mods, opts.dbPath);
  app.get('/api/health', async () => ({ ok: true, version: VERSION }));
  for (const m of mods) await app.register((a) => m.routes(a, ctx), { prefix: `/api/${m.id}` });

  const webDist = opts.webDist;
  if (webDist) await app.register(fastifyStatic, { root: webDist });
  app.setNotFoundHandler((req, reply) => {
    if (webDist && req.method === 'GET' && !/^\/api(\/|\?|$)/.test(req.url))return reply.sendFile('index.html');
    return reply.status(404).send(body('no_encontrado', 'No encontrado.'));
  });

  app.addHook('onClose', async () => { db.close(); });
  return Object.assign(app, { ctx }) as unknown as FastifyInstance & { ctx: CoreContext };
}
