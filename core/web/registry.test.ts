import { expect, test } from 'vitest';
import { resolveEnabled, type WebModule } from './registry.ts';

const m = (id: string, requires?: string[]) => ({ id, requires }) as WebModule;

test('suma requires registrados e ignora los no registrados', () => {
  const all = [m('a', ['b', 'calendar']), m('b'), m('c')];
  expect(resolveEnabled(all, (id) => id === 'a').map((x) => x.id)).toEqual(['a', 'b']);
});
