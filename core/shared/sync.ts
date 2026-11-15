/** Registros y reloj lógico híbrido (HLC) del motor de sincronización. Lo usan la app y el server: una sola regla de mezcla. */

export type Rec = { t: string; id: string; data: object | null; hlc: string };

const HLC_RE = /^(\d{13})-([0-9a-f]{4})-([A-Za-z0-9-]{1,40})$/;
export const isHlc = (s: unknown): s is string => typeof s === 'string' && HLC_RE.test(s);

export const fmtHlc = (ms: number, c: number, node: string): string =>
  `${String(ms).padStart(13, '0')}-${c.toString(16).padStart(4, '0')}-${node}`;
export function parseHlc(h: string): { ms: number; c: number; node: string } {
  const m = HLC_RE.exec(h)!;
  return { ms: Number(m[1]), c: parseInt(m[2]!, 16), node: m[3]! };
}
/** Se queda el de HLC mayor (se ordenan como texto). */
export const newer = (a: string, b: string): boolean => a > b;

export const MAX_RECORD_BYTES = 256 * 1024;
const COLLECTION_RE = /^[a-z][a-z0-9_]{0,39}$/;
/** Forma de un registro que llega de afuera (el server solo valida esto, no reglas de negocio). */
export function isRec(x: unknown): x is Rec {
  const r = x as Rec | null;
  return !!r && typeof r === 'object' && typeof r.t === 'string' && COLLECTION_RE.test(r.t)
    && typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 100 && isHlc(r.hlc)
    && (r.data === null || (typeof r.data === 'object' && !Array.isArray(r.data) && JSON.stringify(r.data).length <= MAX_RECORD_BYTES));
}

/** Reloj: nunca retrocede, aunque la hora del dispositivo vaya para atrás. */
export class Clock {
  private ms = 0;
  private c = 0;
  readonly node: string;
  private now: () => number;
  constructor(node: string, now: () => number = Date.now) { this.node = node; this.now = now; }
  /** HLC para un cambio local. */
  tick(): string {
    const t = this.now();
    if (t > this.ms) { this.ms = t; this.c = 0; } else this.c++;
    if (this.c > 0xffff) { this.ms++; this.c = 0; }
    return fmtHlc(this.ms, this.c, this.node);
  }
  /** Al ver un HLC ajeno: lo que se edite después queda siempre por encima. */
  recv(h: string): void {
    const r = parseHlc(h);
    const ms = Math.max(this.ms, r.ms, this.now());
    this.c = ms === this.ms && ms === r.ms ? Math.max(this.c, r.c) + 1 : ms === this.ms ? this.c + 1 : ms === r.ms ? r.c + 1 : 0;
    this.ms = ms;
  }
}

/** Las marcas de borrado se limpian pasados estos días (por el `ms` del HLC). */
export const TOMBSTONE_DAYS = 180;
export const tombstoneExpired = (hlc: string, nowMs: number): boolean => parseHlc(hlc).ms < nowMs - TOMBSTONE_DAYS * 86_400_000;
