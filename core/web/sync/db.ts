import { Clock, isHlc, newer, tombstoneExpired, type Rec } from '../../shared/sync.ts';

/** Base local: TODO en memoria (son pocos datos) y persistida en un LocalStore. `dirty` = cambio todavía no subido. */
export type Row = Rec & { dirty: 0 | 1 };
export interface LocalStore {
  load(): Promise<{ rows: Row[]; meta: Record<string, string> }>;
  /** Una transacción: guarda `put`, borra `del` (pares [t, id]) y mezcla `meta`. */
  apply(put: Row[], del: [string, string][], meta?: Record<string, string>): Promise<void>;
}

export class LocalDb {
  private cols = new Map<string, Map<string, Row>>();
  private clock: Clock;
  private chain: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private undo: Map<string, Row | undefined> | null = null; // dentro de transaction(): lo que había antes
  private txPut = new Map<string, Row>();
  /** Último error al persistir (la UI lo puede mostrar); null si todo va bien. */
  error: unknown = null;

  private store: LocalStore;
  private meta: Record<string, string>;
  private now: () => number;

  private constructor(store: LocalStore, rows: Row[], meta: Record<string, string>, now: () => number) {
    this.store = store; this.meta = meta; this.now = now;
    this.clock = new Clock(meta.deviceId!, now);
    for (const r of rows) {
      this.col(r.t).set(r.id, r);
      this.clock.recv(r.hlc); // el reloj arranca por encima de todo lo que ya hay
    }
  }
  static async open(store: LocalStore, now: () => number = Date.now): Promise<LocalDb> {
    const { rows, meta } = await store.load();
    if (!meta.deviceId) {
      meta.deviceId = [...crypto.getRandomValues(new Uint8Array(3))].map((b) => b.toString(16).padStart(2, '0')).join('');
      await store.apply([], [], { deviceId: meta.deviceId });
    }
    return new LocalDb(store, rows.filter((r) => isHlc(r.hlc)), meta, now);
  }

  private col(t: string) {
    let c = this.cols.get(t);
    if (!c) this.cols.set(t, (c = new Map()));
    return c;
  }
  private persist(put: Row[], del: [string, string][] = [], meta?: Record<string, string>) {
    this.chain = this.chain.then(() => this.store.apply(put, del, meta)).then(() => { this.error = null; }, (e) => { this.error = e; });
  }
  /** Espera a que lo escrito hasta ahora esté guardado (p. ej. al pasar a segundo plano). */
  flushed(): Promise<void> { return this.chain; }
  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => void this.listeners.delete(fn); }
  private emit() { this.listeners.forEach((f) => f()); }

  get deviceId(): string { return this.meta.deviceId!; }
  getMeta(k: string): string | undefined { return this.meta[k]; }
  setMeta(k: string, v: string): void { this.meta[k] = v; this.persist([], [], { [k]: v }); }

  /** Documentos vivos de una colección. */
  all<T = object>(t: string): T[] {
    return [...(this.cols.get(t)?.values() ?? [])].filter((r) => r.data !== null).map((r) => r.data as T);
  }
  get<T = object>(t: string, id: string): T | undefined { return (this.cols.get(t)?.get(id)?.data ?? undefined) as T | undefined; }

  /** Crea o reemplaza un documento. */
  put(t: string, id: string, data: object): void { this.write(t, id, data); }
  /** Borra dejando una marca (para que viaje a los demás dispositivos). */
  remove(t: string, id: string): void { if (this.get(t, id) !== undefined) this.write(t, id, null); }

  private write(t: string, id: string, data: object | null) {
    const row: Row = { t, id, data, hlc: this.clock.tick(), dirty: 1 };
    const key = `${t}\0${id}`;
    if (this.undo && !this.undo.has(key)) this.undo.set(key, this.cols.get(t)?.get(id));
    this.col(t).set(id, row);
    if (this.undo) this.txPut.set(key, row); else this.persist([row]);
    this.emit();
  }

  /** Agrupa varias escrituras en una sola persistencia; si `fn` lanza, no queda nada. */
  transaction<T>(fn: () => T): T {
    if (this.undo) return fn();
    this.undo = new Map();
    this.txPut = new Map();
    try {
      const r = fn();
      this.persist([...this.txPut.values()]);
      return r;
    } catch (e) {
      for (const [key, old] of this.undo) {
        const [t, id] = key.split('\0') as [string, string];
        if (old) this.col(t).set(id, old); else this.col(t).delete(id);
      }
      this.emit();
      throw e;
    } finally {
      this.undo = null;
    }
  }

  // --- lo que usa el motor de sincronización ---
  dirtyRows(): Row[] { return [...this.cols.values()].flatMap((c) => [...c.values()]).filter((r) => r.dirty); }
  pendingCount(): number { return this.dirtyRows().length; }

  /** Mezcla lo que llegó del destino: se queda el de HLC mayor. Devuelve cuántos registros cambiaron. */
  merge(recs: Rec[]): number {
    const put: Row[] = [];
    for (const r of recs) {
      this.clock.recv(r.hlc);
      const mine = this.cols.get(r.t)?.get(r.id);
      if (mine && !newer(r.hlc, mine.hlc)) continue;
      const row: Row = { t: r.t, id: r.id, data: r.data, hlc: r.hlc, dirty: 0 };
      this.col(r.t).set(r.id, row);
      put.push(row);
    }
    if (put.length) { this.persist(put); this.emit(); }
    return put.length;
  }
  /** Marca como subidos los registros confirmados, salvo los que se volvieron a editar mientras tanto. */
  markPushed(recs: Rec[]): void {
    const put: Row[] = [];
    for (const r of recs) {
      const mine = this.cols.get(r.t)?.get(r.id);
      if (mine && mine.hlc === r.hlc && mine.dirty) { mine.dirty = 0; put.push(mine); }
    }
    if (put.length) this.persist(put);
  }
  /** El destino perdió datos: todo lo local vuelve a quedar pendiente de subir. */
  markAllDirty(): void {
    const put: Row[] = [];
    for (const c of this.cols.values()) for (const r of c.values()) if (!r.dirty) { r.dirty = 1; put.push(r); }
    if (put.length) this.persist(put);
  }
  /** Reset: saca lo que el destino ya no tiene (sin tocar lo no subido). */
  dropUnseen(seen: Set<string>): void {
    const del: [string, string][] = [];
    for (const [t, c] of this.cols) for (const [id, r] of c) if (!r.dirty && !seen.has(`${t}\0${id}`)) { c.delete(id); del.push([t, id]); }
    if (del.length) { this.persist([], del); this.emit(); }
  }
  /** Limpia marcas de borrado ya subidas y viejas. */
  purgeTombstones(): void {
    const del: [string, string][] = [];
    for (const [t, c] of this.cols) for (const [id, r] of c) if (r.data === null && !r.dirty && tombstoneExpired(r.hlc, this.now())) { c.delete(id); del.push([t, id]); }
    if (del.length) this.persist([], del);
  }
}
