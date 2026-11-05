export type Store = { get(k: string): string | null; set(k: string, v: string): void };
export type QueueOp = { id: string; completed: boolean; baseUpdatedAt: string | null; at: string };
type Req = (method: 'GET' | 'PATCH', path: string, body?: unknown) => Promise<{ status: number; json: unknown }>;
type Copy = { data: unknown; at: string };

// localStorage se resuelve al llamar (no al importar) para poder correr sin DOM.
const ls = (): Store => ({ get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v) });
const INDEX = 'sw.index';
const QUEUE = 'sw.queue';
const urls = (s: Store): string[] => JSON.parse(s.get(INDEX) ?? '[]');
const copyKey = (url: string) => `sw.copy.${url}`;

export function saveCopy(url: string, data: unknown, at: string, s: Store = ls()): void {
  if (!urls(s).includes(url)) s.set(INDEX, JSON.stringify([...urls(s), url]));
  s.set(copyKey(url), JSON.stringify({ data, at }));
}

export function readCopy<T>(url: string, s: Store = ls()): { data: T; at: string } | undefined {
  const raw = s.get(copyKey(url));
  return raw ? JSON.parse(raw) : undefined;
}

export function lastCopyAt(s: Store = ls()): string | null {
  let max: string | null = null;
  for (const u of urls(s)) {
    const at = readCopy(u, s)?.at;
    if (at && (!max || at > max)) max = at;
  }
  return max;
}

export function isQueueable(method: string, path: string, body: unknown): boolean {
  if (method !== 'PATCH' || !/^\/api\/todo\/[^/?]+$/.test(path)) return false;
  const keys = body && typeof body === 'object' ? Object.keys(body) : [];
  return keys.length === 1 && keys[0] === 'completed' && typeof (body as { completed: unknown }).completed === 'boolean';
}

export function pending(s: Store = ls()): QueueOp[] {
  return JSON.parse(s.get(QUEUE) ?? '[]');
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;

// Recorre cualquier estructura y llama fn en cada objeto.
function walk(v: unknown, fn: (o: Obj) => void): void {
  if (Array.isArray(v)) v.forEach((x) => walk(x, fn));
  else if (isObj(v)) {
    fn(v);
    Object.values(v).forEach((x) => walk(x, fn));
  }
}

export function enqueue(id: string, completed: boolean, at: string, s: Store = ls()): QueueOp {
  const q = pending(s);
  const prev = q.find((o) => o.id === id);
  let base: string | null = prev?.baseUpdatedAt ?? null;
  if (!prev) {
    for (const u of urls(s)) {
      walk(readCopy(u, s)?.data, (o) => {
        if (base === null && o.id === id && 'completed' in o && typeof o.updatedAt === 'string') base = o.updatedAt;
      });
      if (base !== null) break;
    }
  }
  const op = { id, completed, baseUpdatedAt: base, at };
  s.set(QUEUE, JSON.stringify(prev ? q.map((o) => (o.id === id ? op : o)) : [...q, op]));
  return op;
}

export function patchCopies(id: string, completed: boolean, at: string, s: Store = ls()): void {
  for (const u of urls(s)) {
    const c = readCopy<unknown>(u, s) as Copy;
    let hit = false;
    walk(c.data, (o) => {
      if (o.id === id && 'completed' in o) {
        o.completed = completed;
        o.completedAt = completed ? at : null;
        hit = true;
      }
    });
    if (hit) s.set(copyKey(u), JSON.stringify(c));
  }
}

export async function flush(req: Req, s: Store = ls()): Promise<{ sent: number; dropped: number; remaining: number }> {
  let sent = 0;
  let dropped = 0;
  for (const op of pending(s)) {
    const rest = () => pending(s).filter((o) => o.id !== op.id);
    try {
      const cur = await req('GET', `/api/todo/${op.id}`);
      // Si cambió desde la compu (o no sabemos la base), gana lo del servidor.
      const stale = cur.status === 404 || (cur.status === 200 && (!isObj(cur.json) || cur.json.updatedAt !== op.baseUpdatedAt));
      if (stale) dropped++;
      else if (cur.status !== 200) break;
      else {
        const r = await req('PATCH', `/api/todo/${op.id}`, { completed: op.completed });
        if (r.status >= 400) dropped++;
        else sent++;
      }
    } catch {
      break; // sin red: el op y los que siguen quedan en la cola
    }
    s.set(QUEUE, JSON.stringify(rest()));
  }
  return { sent, dropped, remaining: pending(s).length };
}
