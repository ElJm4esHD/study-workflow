import { isRec, tombstoneExpired, type Rec } from '../../shared/sync.ts';
import type { SyncTarget } from './engine.ts';

/**
 * Adaptador "Google Drive": solo archivos planos en appDataFolder, que nunca se modifican (solo se crean y borran):
 *   epoch-<uuid>.json        identifica la carpeta (si desaparece o cambia, el motor vuelve a subir todo lo local)
 *   log-<hlc>-<azar>.json    { records }: lo que subió un push
 *   snap-<hlc>-<p|n>.json    { records }: estado mezclado de una compactación; `p` = descartó marcas de borrado viejas
 * El cursor es el conjunto de archivos ya leídos: no depende de relojes ni de que Drive tarde en listar un archivo nuevo.
 */

export class NotFound extends Error {}
/** El token venció o fue revocado (401): la capa de login muestra "reconectar". */
export class AuthError extends Error {}

/** Lo mínimo de Drive que usa el adaptador. `driveRest` es la real; en los tests, una en memoria. */
export interface DriveFiles {
  list(): Promise<{ id: string; name: string }[]>;
  read(id: string): Promise<string>; // NotFound si ya no existe
  create(name: string, body: string): Promise<void>;
  remove(id: string): Promise<void>; // si ya no existe, no falla
}

type Cursor = { v: 1; e: string | null; s: string[]; l: string[] };
const hex = () => [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');

function parseCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    return c?.v === 1 && Array.isArray(c.s) && Array.isArray(c.l) ? c : null; // un cursor que no es de Drive se trata como dispositivo nuevo
  } catch { return null; }
}

export function driveTarget(fs: DriveFiles, opts: { now?: () => number; compactAt?: number; page?: number } = {}): SyncTarget {
  const { now = Date.now, compactAt = 200, page = 50 } = opts;
  let epochOk = false; // ya sé que hay epoch (se ahorra un listado por push)

  const group = async (): Promise<Map<string, string[]>> => {
    const m = new Map<string, string[]>(); // Drive permite nombres repetidos: se tratan como un solo archivo
    for (const f of await fs.list()) (m.get(f.name) ?? m.set(f.name, []).get(f.name)!).push(f.id);
    return m;
  };
  const readRecs = async (files: Map<string, string[]>, name: string): Promise<Rec[]> => {
    const j = JSON.parse(await fs.read(files.get(name)![0]!));
    return Array.isArray(j?.records) ? j.records.filter(isRec) : []; // lo que no tiene forma de registro se ignora
  };
  const drop = (files: Map<string, string[]>, names: string[]) => Promise.all(names.flatMap((n) => (files.get(n) ?? []).map((id) => fs.remove(id))));

  /** Junta todo en un snapshot y borra solo lo que incluyó. Si otro dispositivo compactó en el medio, se saltea. */
  async function compact(files: Map<string, string[]>, names: string[]): Promise<string | null> {
    const best = new Map<string, Rec>();
    try {
      for (const n of names) for (const r of await readRecs(files, n)) {
        const k = `${r.t}\0${r.id}`;
        if (!best.has(k) || r.hlc > best.get(k)!.hlc) best.set(k, r);
      }
    } catch (e) { if (e instanceof NotFound) return null; throw e; }
    const all = [...best.values()];
    const keep = all.filter((r) => !(r.data === null && tombstoneExpired(r.hlc, now())));
    const top = all.reduce((m, r) => (r.hlc > m ? r.hlc : m), '');
    if (!top) return null;
    const snap = `snap-${top}-${keep.length < all.length ? 'p' : 'n'}.json`;
    if (!files.has(snap)) await fs.create(snap, JSON.stringify({ records: keep }));
    await drop(files, names.filter((n) => n !== snap));
    return snap;
  }

  async function pullOnce(cursor: string | null) {
    const files = await group();
    const names = [...files.keys()];
    const epoch = names.filter((n) => n.startsWith('epoch-')).sort()[0] ?? null;
    epochOk = epoch !== null;
    if (names.filter((n) => n.startsWith('epoch-')).length > 1) await drop(files, names.filter((n) => n.startsWith('epoch-') && n !== epoch)); // carrera al crearlo: vale el menor
    const snaps = names.filter((n) => n.startsWith('snap-')).sort();
    const logs = names.filter((n) => n.startsWith('log-')).sort();

    let c = parseCursor(cursor);
    let reset: 'epoch' | 'purged' | undefined;
    if (!c) c = { v: 1, e: epoch, s: [], l: [] };
    else if (c.e !== null && c.e !== epoch) { reset = 'epoch'; c = { v: 1, e: epoch, s: [], l: [] }; } // otra carpeta o borrada: lectura completa
    else if (snaps.some((n) => !c!.s.includes(n) && n.endsWith('-p.json'))) { reset = 'purged'; c = { v: 1, e: epoch, s: [], l: [] }; } // se descartaron marcas de borrado
    else c = { v: 1, e: epoch, s: c.s.filter((n) => files.has(n)), l: c.l.filter((n) => files.has(n)) };

    const unread = [...snaps.filter((n) => !c!.s.includes(n)), ...logs.filter((n) => !c!.l.includes(n))];
    const batch = unread.slice(0, page);
    const records: Rec[] = [];
    for (const n of batch) {
      records.push(...(await readRecs(files, n)));
      (n.startsWith('snap-') ? c.s : c.l).push(n);
    }
    const more = unread.length > page;
    if (!more && logs.length > compactAt) {
      const snap = await compact(files, [...snaps, ...logs]);
      if (snap) {
        c.s = [snap]; // compact borró todo lo listado salvo el snapshot; lo que llegó después se lee en el próximo pull
        c.l = [];
      }
    }
    return { records, cursor: JSON.stringify(c), more, ...(reset ? { reset } : {}) };
  }

  return {
    async push(records) {
      if (records.length === 0) return;
      if (!epochOk) {
        const files = await group();
        if (![...files.keys()].some((n) => n.startsWith('epoch-'))) await fs.create(`epoch-${crypto.randomUUID()}.json`, '{}');
        epochOk = true;
      }
      const top = records.reduce((m, r) => (r.hlc > m ? r.hlc : m), '');
      await fs.create(`log-${top}-${hex()}.json`, JSON.stringify({ records }));
    },
    async pull(cursor) {
      try { return await pullOnce(cursor); }
      catch (e) { if (!(e instanceof NotFound)) throw e; return pullOnce(cursor); } // otro dispositivo compactó entre el listado y la lectura
    },
  };
}

/** Drive real (REST v3, solo appDataFolder). `token()` da un access token vigente o lanza si hay que reconectar. */
export function driveRest(token: () => Promise<string>, doFetch: typeof fetch = fetch): DriveFiles {
  const API = 'https://www.googleapis.com';
  const call = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const res = await doFetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(30000) });
    if (res.status === 401) throw new AuthError('La sesión de Google venció.');
    if (res.status === 404) throw new NotFound();
    if (!res.ok) throw new Error(`Google Drive respondió ${res.status}.`);
    return res;
  };
  return {
    async list() {
      const out: { id: string; name: string }[] = [];
      let next = '';
      do {
        const res = await call(`${API}/drive/v3/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name)${next}`);
        const j = await res.json();
        out.push(...(j.files ?? []));
        next = j.nextPageToken ? `&pageToken=${encodeURIComponent(j.nextPageToken)}` : '';
      } while (next);
      return out;
    },
    read: async (id) => (await call(`${API}/drive/v3/files/${encodeURIComponent(id)}?alt=media`)).text(),
    async create(name, body) {
      const b = 'swboundary';
      await call(`${API}/upload/drive/v3/files?uploadType=multipart`, {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` },
        body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`,
      });
    },
    async remove(id) {
      try { await call(`${API}/drive/v3/files/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
      catch (e) { if (!(e instanceof NotFound)) throw e; }
    },
  };
}
