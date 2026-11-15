import type { LocalDb } from '../web/sync/db.ts';
import type { LocalRouter } from './router.ts';

export type Materia = {
  id: string; name: string; color: string; colorStrong: string; sigla: string; archived: boolean; createdAt: string; updatedAt: string;
};

export interface MateriasService {
  list(): Materia[];
  get(id: string): Materia | undefined;
  findByNameKey(key: string): Materia | undefined;
  create(input: { id?: string; name: string; color: string; sigla?: string | null }): Materia;
  update(id: string, patch: { name?: string; color?: string; archived?: boolean; sigla?: string }): Materia;
}

export interface SettingsService {
  getAll(): Record<string, unknown>;
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
}

/** Un resultado de la búsqueda global: `to` es la ruta de la app donde se abre. */
export type SearchHit = { id: string; kind: string; title: string; detail?: string; to: string };

/** Una colección de documentos (cada uno con `id`) sobre la base local. Los documentos se tratan como inmutables: se reemplazan, no se modifican. */
export interface Collection<T extends { id: string }> {
  all(): T[];
  get(id: string): T | undefined;
  put(doc: T): void;
  remove(id: string): void;
}

/** Contrato de un módulo (ver docs/modulos.md): la lógica corre dentro de la app, sobre colecciones locales. */
export interface AppModule {
  id: string;
  requires?: string[];
  /** Colecciones propias, con el prefijo del módulo (`todo_items`). */
  collections: string[];
  routes(r: LocalRouter, ctx: AppContext): void;
  service?(ctx: AppContext): object;
  /** Búsqueda global: devuelve lo propio del módulo que coincide con `q` (ya sin espacios sobrantes). */
  search?(ctx: AppContext, q: string): SearchHit[];
}

export interface AppContext {
  db: LocalDb;
  col<T extends { id: string }>(name: string): Collection<T>;
  transaction<T>(fn: () => T): T;
  materias: MateriasService;
  settings: SettingsService;
  modules: { isEnabled(id: string): boolean };
  services: { get<T>(id: string): T | undefined };
}

export function orderModules(mods: AppModule[]): AppModule[] {
  const byId = new Map(mods.map((m) => [m.id, m]));
  const out: AppModule[] = [];
  const seen = new Set<string>();
  const visit = (m: AppModule, path: string[]) => {
    if (seen.has(m.id)) return;
    if (path.includes(m.id)) throw new Error(`Dependencia circular en ${m.id}`);
    for (const r of m.requires ?? []) {
      const dep = byId.get(r);
      if (!dep) throw new Error(`Módulo ${m.id} requiere ${r}`);
      visit(dep, [...path, m.id]);
    }
    seen.add(m.id);
    out.push(m);
  };
  for (const m of mods) visit(m, []);
  return out;
}
