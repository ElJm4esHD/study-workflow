import { expect, test } from 'vitest';
import { enqueue, flush, isQueueable, lastCopyAt, patchCopies, pending, readCopy, saveCopy, type Store } from './offline.ts';

const mem = (): Store => {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
};
const todo = (id: string, completed = false) => ({ id, title: id, completed, completedAt: null, updatedAt: 'u1' });

test('isQueueable: solo PATCH /api/todo/:id con {completed:boolean}', () => {
  expect(isQueueable('PATCH', '/api/todo/abc', { completed: true })).toBe(true);
  expect(isQueueable('PATCH', '/api/todo/abc', { completed: true, title: 'x' })).toBe(false);
  expect(isQueueable('PATCH', '/api/todo', { completed: true })).toBe(false);
  expect(isQueueable('POST', '/api/todo/abc', { completed: true })).toBe(false);
  expect(isQueueable('PATCH', '/api/todo/abc', { completed: 'si' })).toBe(false);
});

test('copias: save/read y lastCopyAt', () => {
  const s = mem();
  saveCopy('/api/a', [1], '2026-11-05T10:00:00Z', s);
  saveCopy('/api/b', [2], '2026-11-05T11:00:00Z', s);
  expect(readCopy('/api/a', s)).toEqual({ data: [1], at: '2026-11-05T10:00:00Z' });
  expect(readCopy('/api/zz', s)).toBeUndefined();
  expect(lastCopyAt(s)).toBe('2026-11-05T11:00:00Z');
});

test('enqueue colapsa por id: true luego false → un op completed:false, baseUpdatedAt original', () => {
  const s = mem();
  saveCopy('/api/todo', [todo('a')], 't0', s);
  enqueue('a', true, 't1', s);
  patchCopies('a', true, 't1', s);
  enqueue('a', false, 't2', s);
  expect(pending(s)).toEqual([{ id: 'a', completed: false, baseUpdatedAt: 'u1', at: 't2' }]);
});

test('patchCopies cambia la tarea en /api/todo, /api/todo/:id y dentro de agenda.todos', () => {
  const s = mem();
  saveCopy('/api/todo', [todo('a'), todo('b')], 't0', s);
  saveCopy('/api/todo/a', todo('a'), 't0', s);
  saveCopy('/api/agenda', { events: [], todos: [todo('a')] }, 't0', s);
  patchCopies('a', true, 't1', s);
  expect(readCopy<any[]>('/api/todo', s)!.data.map((t) => [t.completed, t.completedAt])).toEqual([[true, 't1'], [false, null]]);
  expect(readCopy<any>('/api/todo/a', s)!.data.completed).toBe(true);
  expect(readCopy<any>('/api/agenda', s)!.data.todos[0].completedAt).toBe('t1');
  patchCopies('a', false, 't2', s);
  expect(readCopy<any>('/api/todo/a', s)!.data).toMatchObject({ completed: false, completedAt: null });
});

const setup = (...ids: string[]) => {
  const s = mem();
  saveCopy('/api/todo', ids.map((i) => todo(i)), 't0', s);
  ids.forEach((i) => enqueue(i, true, 't1', s));
  return s;
};

test('flush: updatedAt igual → PATCH y sale de la cola', async () => {
  const s = setup('a');
  const calls: string[] = [];
  const r = await flush(async (m, p, b) => {
    calls.push(`${m} ${p} ${JSON.stringify(b ?? '')}`);
    return { status: 200, json: m === 'GET' ? todo('a') : {} };
  }, s);
  expect(calls).toEqual(['GET /api/todo/a ""', 'PATCH /api/todo/a {"completed":true}']);
  expect(r).toEqual({ sent: 1, dropped: 0, remaining: 0 });
  expect(pending(s)).toEqual([]);
});

test('flush: updatedAt distinto (cambio desde la compu) → descarta sin PATCH', async () => {
  const s = setup('a');
  const methods: string[] = [];
  const r = await flush(async (m) => {
    methods.push(m);
    return { status: 200, json: { ...todo('a'), updatedAt: 'u2' } };
  }, s);
  expect(methods).toEqual(['GET']);
  expect(r).toEqual({ sent: 0, dropped: 1, remaining: 0 });
});

test('flush: 404 → descarta', async () => {
  const s = setup('a');
  const r = await flush(async () => ({ status: 404, json: {} }), s);
  expect(r).toEqual({ sent: 0, dropped: 1, remaining: 0 });
});

test('flush: error de red en el 2do op → sent 1, remaining 2, sin duplicar', async () => {
  const s = setup('a', 'b', 'c');
  let n = 0;
  const r = await flush(async (_m, p) => {
    if (p === '/api/todo/b') throw new TypeError('red');
    n++;
    return { status: 200, json: todo(p.split('/').pop()!) };
  }, s);
  expect(r).toEqual({ sent: 1, dropped: 0, remaining: 2 });
  expect(pending(s).map((o) => o.id)).toEqual(['b', 'c']);
  expect(n).toBe(2); // GET + PATCH de 'a'
});
