import { LocalDb } from '../web/sync/db.ts';
import { memoryStore } from '../web/sync/stores.ts';
import { buildLocalApp } from './app.ts';
import type { AppModule } from './registry.ts';

type Inject = string | { method?: string; url: string; payload?: unknown };

/** App local en memoria para los tests; `inject` imita el de Fastify para poder reusar los tests de siempre. */
export async function makeTestApp(modules: AppModule[] = []) {
  const db = await LocalDb.open(memoryStore());
  const { router, ctx } = buildLocalApp(db, modules);
  const inject = async (i: Inject) => {
    const { method = 'GET', url, payload } = typeof i === 'string' ? { url: i } : i;
    const r = router.handle(method, url, payload);
    const body = r.body === undefined ? '' : JSON.stringify(r.body);
    return { statusCode: r.status, body, json: () => JSON.parse(body) };
  };
  return { inject, ctx, db, router };
}
