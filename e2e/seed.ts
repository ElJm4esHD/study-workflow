import type { APIRequestContext } from '@playwright/test';
import { makeTestApp } from '../core/app/testing.ts';
import { appModules } from '../modules/app.ts';

/**
 * Datos de ejemplo para las pruebas del navegador. La app guarda todo en el dispositivo, así que se arman con la misma lógica de la app
 * (en Node) y se suben al server por /api/sync/push: el navegador los baja en su primer arranque.
 * Mismo uso que `request` (post/patch/get con `{ data }`), pero resuelto localmente; `flush()` los sube.
 */
export type SeedApi = Awaited<ReturnType<typeof seedApi>>;

export async function seedApi(request: APIRequestContext) {
  const app = await makeTestApp(appModules);
  for (let cursor: string | null = null; ;) { // parte de lo que ya hay en el server (otros tests)
    const page: { records: never[]; cursor: string; more: boolean } = await (await request.get(`/api/sync/pull?limit=1000${cursor ? `&since=${encodeURIComponent(cursor)}` : ''}`)).json();
    app.db.merge(page.records);
    if (!page.more) break;
    cursor = page.cursor;
  }
  const call = async (method: string, url: string, o?: { data?: object }) => {
    const r = await app.inject({ method, url, payload: o?.data });
    return { status: () => r.statusCode, ok: () => r.statusCode < 400, json: async () => r.json() };
  };
  return {
    get: (url: string) => call('GET', url),
    post: (url: string, o?: { data?: object }) => call('POST', url, o),
    patch: (url: string, o?: { data?: object }) => call('PATCH', url, o),
    async flush() {
      const rows = app.db.dirtyRows().map(({ t, id, data, hlc }) => ({ t, id, data, hlc }));
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const r = await request.post('/api/sync/push', { data: { records: batch } });
        if (!r.ok()) throw new Error(`push falló: ${r.status()} ${await r.text()}`);
        app.db.markPushed(batch);
      }
    },
  };
}
