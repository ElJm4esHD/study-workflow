import type { FastifyInstance } from 'fastify';

export function registerAuth(app: FastifyInstance): void {
  // Punto de enganche para auth (v1 sin login: acceso limitado a la tailnet).
  app.addHook('onRequest', async () => {});
}
