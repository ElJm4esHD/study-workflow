import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NOVEDADES } from './novedades.ts';

test('la última novedad es la versión de package.json y las versiones bajan', () => {
  const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  expect(NOVEDADES[0]!.version).toBe(version);
  // 2.0.0-beta.N queda por debajo de 2.0.0
  const n = (v: string) => { const [x, y, z, b] = v.split(/[.-]/).filter((s) => s !== 'beta').map(Number); return ((x! * 1000 + y!) * 1000 + z!) * 1000 + (b ?? 999); };
  for (let i = 1; i < NOVEDADES.length; i++) expect(n(NOVEDADES[i - 1]!.version)).toBeGreaterThan(n(NOVEDADES[i]!.version));
});
