import type { FastifyInstance } from 'fastify';

export function registerCors(app: FastifyInstance, origins: string[]): void {
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (!origin) return;
    reply.header('Vary', 'Origin');
    if (!origins.includes(origin)) return;
    reply.header('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS' && req.headers['access-control-request-method']) {
      return reply
        .header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE')
        .header('Access-Control-Allow-Headers', 'content-type')
        .status(204).send();
    }
  });
}
