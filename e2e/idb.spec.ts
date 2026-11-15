import { expect, test } from '@playwright/test';
import { build } from 'vite';

// idbStore contra IndexedDB de verdad: persistir, cerrar y reabrir, y transacción con rollback.
let bundle = '';
test.beforeAll(async () => {
  const out = await build({
    configFile: false, logLevel: 'silent',
    build: { write: false, lib: { entry: 'e2e/idb-entry.ts', formats: ['iife'], name: 'swIdb' }, minify: false },
  }) as { output: { code: string }[] }[] | { output: { code: string }[] };
  bundle = (Array.isArray(out) ? out[0]! : out).output[0]!.code;
});

const load = async (page: import('@playwright/test').Page) => {
  await page.goto('/api/health'); // un origen http real (about:blank no tiene IndexedDB)
  await page.addScriptTag({ content: bundle });
};

test('persiste, sobrevive a cerrar y reabrir, y la transacción con error no deja nada', async ({ page }) => {
  const name = `t-${Date.now()}`;
  await load(page);
  const first = await page.evaluate(async (n) => {
    const sw = (window as any).sw;
    const db = await sw.open(n);
    db.put('todo', 'a', { title: 'A' });
    db.transaction(() => { db.put('todo', 'b', { title: 'B' }); db.put('todo', 'c', { title: 'C' }); });
    try { db.transaction(() => { db.put('todo', 'a', { title: 'A roto' }); db.put('todo', 'd', { title: 'D' }); throw new Error('x'); }); } catch { /* esperado */ }
    db.remove('todo', 'c');
    db.setMeta('cursor', 'cur-1');
    await db.flushed();
    return { deviceId: db.deviceId, titles: db.all('todo').map((x: any) => x.title).sort(), error: db.error };
  }, name);
  expect(first.titles).toEqual(['A', 'B']);
  expect(first.error).toBeNull();

  await page.close(); // cerrar de verdad
  const page2 = await page.context().newPage();
  await load(page2);
  const second = await page2.evaluate(async (n) => {
    const db = await (window as any).sw.open(n);
    const dirty = db.dirtyRows().map((r: any) => `${r.id}:${r.data === null ? 'borrado' : 'vivo'}`).sort();
    // reabierto: el reloj sigue por encima y se puede seguir escribiendo
    db.put('todo', 'a', { title: 'A2' });
    await db.flushed();
    return { deviceId: db.deviceId, cursor: db.getMeta('cursor'), titles: db.all('todo').map((x: any) => x.title).sort(), dirty };
  }, name);
  expect(second.deviceId).toBe(first.deviceId);
  expect(second.cursor).toBe('cur-1');
  expect(second.titles).toEqual(['A2', 'B']);
  expect(second.dirty).toEqual(['a:vivo', 'b:vivo', 'c:borrado']); // d y "A roto" nunca se guardaron

  await page2.reload();
  await page2.addScriptTag({ content: bundle });
  const third = await page2.evaluate(async (n) => {
    const db = await (window as any).sw.open(n);
    return db.all('todo').map((x: any) => x.title).sort();
  }, name);
  expect(third).toEqual(['A2', 'B']);
});
