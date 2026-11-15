import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NOVEDADES } from './novedades.ts';

test('la última novedad es la versión de package.json y las versiones bajan', () => {
  const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  expect(NOVEDADES[0]!.version).toBe(version);
  const n = (v: string) => v.split('.').reduce((a, x) => a * 1000 + Number(x), 0);
  for (let i = 1; i < NOVEDADES.length; i++) expect(n(NOVEDADES[i - 1]!.version)).toBeGreaterThan(n(NOVEDADES[i]!.version));
});
