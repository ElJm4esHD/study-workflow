import { expect, test } from 'vitest';
import { dashboardCards, prefetchUrls, resolveEnabled, type WebModule } from './registry.ts';

const m = (id: string, requires?: string[]) => ({ id, requires }) as WebModule;

test('suma requires registrados e ignora los no registrados', () => {
  const all = [m('a', ['b', 'calendar']), m('b'), m('c')];
  expect(resolveEnabled(all, (id) => id === 'a').map((x) => x.id)).toEqual(['a', 'b']);
});

test('dashboardCards ordena por order, reparte por column e ignora módulos sin dashboard', () => {
  const C = () => null;
  const d = (id: string, order: number, column: 'left' | 'right') => ({ id, order, column, Card: C });
  const mods = [
    { id: 'x', dashboard: [d('b', 20, 'right'), d('c', 30, 'left')] },
    { id: 'y' },
    { id: 'z', dashboard: [d('a', 10, 'left')] },
  ] as WebModule[];
  const r = dashboardCards(mods);
  expect(r.all.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  expect(r.left.map((c) => c.id)).toEqual(['a', 'c']);
  expect(r.right.map((c) => c.id)).toEqual(['b']);
});

test('prefetchUrls junta las de los módulos y suma materias y settings sin duplicados', () => {
  const mods = [{ id: 'a', prefetch: () => ['/api/todo', '/api/materias'] }, { id: 'b' }] as WebModule[];
  expect(prefetchUrls(mods)).toEqual(['/api/todo', '/api/materias', '/api/settings']);
});
