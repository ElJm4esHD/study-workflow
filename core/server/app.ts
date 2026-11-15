import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { constants, createBrotliCompress, createGzip } from 'node:zlib';
import { Readable } from 'node:stream';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { registerAuth } from './auth.ts';
import { registerCors } from './cors.ts';
import { openDb } from './db.ts';
import { HttpError } from './errors.ts';
import { runMigrations } from './migrate.ts';
import { registerSync } from './sync.ts';

const VERSION: string = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

const body = (code: string, message: string) => ({ error: { code, message } });

/** El server solo recibe y entrega registros de sincronización (ver core/server/sync.ts) y sirve la web: no conoce módulos ni reglas. */
export async function buildApp(opts: { dbPath: string; webDist?: string }): Promise<FastifyInstance & { db: DatabaseSync }> {
  const db = openDb(opts.dbPath);
  runMigrations(db, [{ module: 'sync', dir: new URL('./migrations/', import.meta.url) }]);

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

  registerSync(app, db);
  app.get('/api/health', async () => ({ ok: true, version: VERSION }));

  const webDist = opts.webDist;
  if (webDist) await app.register(fastifyStatic, { root: webDist });
  app.setNotFoundHandler((req, reply) => {
    if (webDist && req.method === 'GET' && !/^\/api(\/|\?|$)/.test(req.url))return reply.sendFile('index.html');
    return reply.status(404).send(body('no_encontrado', 'No encontrado.'));
  });

  app.addHook('onClose', async () => { db.close(); });
  return Object.assign(app, { db }) as unknown as FastifyInstance & { db: DatabaseSync };
}
