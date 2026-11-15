import { HttpError } from '../shared/errors.ts';

/** Router local: las mismas rutas '/api/...' de siempre, pero resueltas dentro de la app (sin red). */
export type Req = { params: Record<string, string>; query: Record<string, string>; body: any };
export type Result = { status: number; body: unknown };

/** Respuesta con otro status (como `reply.status(201).send(x)` de Fastify). */
export class Reply {
  status = 200;
  body: unknown = undefined;
  code(n: number) { this.status = n; return this; }
  send(b?: unknown) { this.body = b; return this; }
}
export const created = (b: unknown) => new Reply().code(201).send(b);
export const noContent = () => new Reply().code(204);

type Handler = (req: Req) => unknown;
/** Tipos del cuerpo: 'string', 'number', 'boolean', 'array', 'object', 'any'; con '?' admite null/ausente; con '!' es obligatorio. */
export type BodySpec = Record<string, string>;
export type Route = { method: string; parts: string[]; handler: Handler; body?: BodySpec };

const bad = (field: string) => new HttpError(400, 'validacion', `Datos inválidos: ${field}.`);
function validate(body: unknown, spec: BodySpec): void {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw bad('cuerpo');
  const b = body as Record<string, unknown>;
  for (const [k, raw] of Object.entries(spec)) {
    const required = raw.endsWith('!');
    const nullable = raw.includes('?');
    const type = raw.replace(/[?!]/g, '');
    const v = b[k];
    if (v === undefined) { if (required) throw bad(k); continue; }
    if (v === null) { if (!nullable) throw bad(k); continue; }
    const ok = type === 'any' || (type === 'array' ? Array.isArray(v) : type === 'object' ? typeof v === 'object' && !Array.isArray(v) : typeof v === type);
    if (!ok) throw bad(k);
  }
}

export class LocalRouter {
  private routes: Route[];
  private prefix: string[];
  constructor(routes: Route[] = [], prefix: string[] = []) { this.routes = routes; this.prefix = prefix; }
  private add(method: string, path: string, a: BodySpec | Handler, b?: Handler) {
    const [body, handler] = typeof a === 'function' ? [undefined, a] : [a, b!];
    this.routes.push({ method, parts: [...this.prefix, ...path.split('/').filter(Boolean)], handler, body });
  }
  /** `get(path, handler)`; los demás también aceptan `(path, bodySpec, handler)`. */
  get(path: string, h: Handler) { this.add('GET', path, h); }
  delete(path: string, h: Handler) { this.add('DELETE', path, h); }
  post(path: string, a: BodySpec | Handler, b?: Handler) { this.add('POST', path, a, b); }
  put(path: string, a: BodySpec | Handler, b?: Handler) { this.add('PUT', path, a, b); }
  patch(path: string, a: BodySpec | Handler, b?: Handler) { this.add('PATCH', path, a, b); }
  /** Un módulo monta sus rutas bajo `/api/<id>`. */
  prefixed(p: string): LocalRouter { return new LocalRouter(this.routes, [...this.prefix, ...p.split('/').filter(Boolean)]); }

  handle(method: string, url: string, body?: unknown): Result {
    try {
      const u = new URL(url, 'http://local');
      const parts = u.pathname.split('/').filter(Boolean);
      for (const r of this.routes) {
        if (r.method !== method || r.parts.length !== parts.length) continue;
        const params: Record<string, string> = {};
        if (!r.parts.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = decodeURIComponent(parts[i]!)), true) : p === parts[i]))) continue;
        if (r.body) validate(body, r.body);
        const out = r.handler({ params, query: Object.fromEntries(u.searchParams), body });
        const res = out instanceof Reply ? out : new Reply().send(out);
        // JSON ida y vuelta: lo que sale es una copia, nadie puede mutar la base en memoria por accidente.
        return { status: res.status, body: res.body === undefined ? undefined : JSON.parse(JSON.stringify(res.body)) };
      }
      return { status: 404, body: { error: { code: 'no_encontrado', message: 'No encontrado.' } } };
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, body: { error: { code: e.code, message: e.message } } };
      console.error(e);
      return { status: 500, body: { error: { code: 'error_interno', message: 'Error interno de la app.' } } };
    }
  }
}
