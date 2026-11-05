import { afterEach, expect, test, vi } from 'vitest';
import { normalizeServerUrl, testServer } from './server.ts';

afterEach(() => vi.unstubAllGlobals());

test('normalizeServerUrl: saca la barra final y exige https', () => {
  expect(normalizeServerUrl(' https://a.ts.net:8443/// ')).toBe('https://a.ts.net:8443');
  expect(normalizeServerUrl('http://a.ts.net')).toBeNull();
  expect(normalizeServerUrl('a.ts.net')).toBeNull();
});

test('testServer: true con {ok:true}, false con 500 o error de red', async () => {
  const res = (ok: boolean, body: unknown) => ({ ok, json: async () => body });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res(true, { ok: true })).mockResolvedValueOnce(res(false, {})).mockRejectedValueOnce(new Error('red')));
  expect(await testServer('https://x')).toBe(true);
  expect(await testServer('https://x')).toBe(false);
  expect(await testServer('https://x')).toBe(false);
});
