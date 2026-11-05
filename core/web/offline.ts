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

const MAX_COPIES = 40; // shortcut: tope de 40 copias, subir o podar por tipo si hace falta

// Mejor esfuerzo: si localStorage se llena, la pantalla online no debe romperse.
export function saveCopy(url: string, data: unknown, at: string, s: Store = ls()): void {
  try {
    let idx = urls(s).filter((u) => u !== url);
    idx.push(url);
    while (idx.length > MAX_COPIES) {
      const old = idx.filter((u) => u !== url).sort((x, y) => (readCopy(x, s)?.at ?? '').localeCompare(readCopy(y, s)?.at ?? ''))[0];
      s.set(copyKey(old), '');
      idx = idx.filter((u) => u !== old);
    }
    s.set(copyKey(url), JSON.stringify({ data, at }));
    s.set(INDEX, JSON.stringify(idx));
  } catch {
    // sin lugar: se sigue sin copia
  }
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
    // El más nuevo: una copia puede haber quedado vieja tras un cambio online.
    for (const u of urls(s)) {
      walk(readCopy(u, s)?.data, (o) => {
        if (o.id === id && 'completed' in o && typeof o.updatedAt === 'string' && (base === null || o.updatedAt > base)) base = o.updatedAt;
      });
    }
  }
  const op = { id, completed, baseUpdatedAt: base, at };
  s.set(QUEUE, JSON.stringify(prev ? q.map((o) => (o.id === id ? op : o)) : [...q, op]));
  return op;
}

// Mezcla `partial` en todo objeto con ese id de todas las copias.
export function mergeCopies(id: string, partial: Obj, s: Store = ls(), needs?: string): void {
  for (const u of urls(s)) {
    const c = readCopy<unknown>(u, s) as Copy | undefined;
    if (!c) continue;
    let hit = false;
    walk(c.data, (o) => {
      if (o.id === id && (!needs || needs in o)) {
        Object.assign(o, partial);
        hit = true;
      }
    });
    if (hit) try { s.set(copyKey(u), JSON.stringify(c)); } catch { /* sin lugar */ }
  }
}

export function patchCopies(id: string, completed: boolean, at: string, s: Store = ls()): void {
  mergeCopies(id, { completed, completedAt: completed ? at : null }, s, 'completed');
}

// Agrega un ítem recién creado a la copia de la lista.
export function appendCopy(url: string, item: unknown, s: Store = ls()): void {
  const c = readCopy<unknown>(url, s);
  if (!c || !Array.isArray(c.data)) return;
  try { s.set(copyKey(url), JSON.stringify({ ...c, data: [...c.data, item] })); } catch { /* sin lugar */ }
}

// Datos frescos del servidor + tildes todavía sin subir: gana lo pendiente.
export function applyPending<T>(data: T, s: Store = ls()): T {
  for (const op of pending(s)) {
    walk(data, (o) => {
      if (o.id === op.id && 'completed' in o) {
        o.completed = op.completed;
        o.completedAt = op.completed ? op.at : null;
      }
    });
  }
  return data;
}

export async function flush(req: Req, s: Store = ls()): Promise<{ sent: number; dropped: number; remaining: number }> {
  let sent = 0;
  let dropped = 0;
  for (const op of pending(s)) {
    let rebase: string | null = null; // updatedAt que dejó nuestro PATCH
    try {
      const cur = await req('GET', `/api/todo/${op.id}`);
      if (cur.status !== 200 && cur.status !== 404) break; // 5xx etc.: reintentar después
      const server = cur.status === 200 && isObj(cur.json) && typeof cur.json.updatedAt === 'string' ? cur.json.updatedAt : null;
      // Si cambió desde la compu gana el servidor; sin base conocida, solo si el servidor es anterior al tilde.
      const stale = cur.status === 404 || server === null || (op.baseUpdatedAt === null ? server >= op.at : server !== op.baseUpdatedAt);
      if (stale) dropped++;
      else {
        const r = await req('PATCH', `/api/todo/${op.id}`, { completed: op.completed });
        if (r.status >= 500) break;
        if (r.status >= 400) dropped++;
        else {
          sent++;
          if (isObj(r.json) && typeof r.json.updatedAt === 'string') rebase = r.json.updatedAt;
        }
      }
    } catch {
      break; // sin red: el op y los que siguen quedan en la cola
    }
    // Si el usuario volvió a tildar durante el envío, ese op nuevo se conserva.
    s.set(QUEUE, JSON.stringify(pending(s).flatMap((o) => (o.id !== op.id || o.at === op.at ? (o.id === op.id ? [] : [o]) : [rebase ? { ...o, baseUpdatedAt: rebase } : o]))));
  }
  return { sent, dropped, remaining: pending(s).length };
}
