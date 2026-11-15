import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';

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

export interface ServerModule {
  id: string;
  migrationsDir: URL;
  requires?: string[];
  routes(app: FastifyInstance, ctx: CoreContext): Promise<void>;
  service?(ctx: CoreContext): object;
  /** Búsqueda global (`/api/search`): devuelve lo propio del módulo que coincide con `q` (ya sin espacios sobrantes). */
  search?(ctx: CoreContext, q: string): SearchHit[];
}

export interface CoreContext {
  db: DatabaseSync;
  transaction<T>(fn: () => T): T;
  materias: MateriasService;
  settings: SettingsService;
  modules: { isEnabled(id: string): boolean };
  services: { get<T>(id: string): T | undefined };
}

export function orderModules(mods: ServerModule[]): ServerModule[] {
  const byId = new Map(mods.map((m) => [m.id, m]));
  const out: ServerModule[] = [];
  const seen = new Set<string>();
  const visit = (m: ServerModule, path: string[]) => {
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
