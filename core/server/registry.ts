import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';

// Placeholders: la Task 3 define estos services.
export interface MateriasService {}
export interface SettingsService {}

export interface ServerModule {
  id: string;
  migrationsDir: URL;
  requires?: string[];
  routes(app: FastifyInstance, ctx: CoreContext): Promise<void>;
  service?(ctx: CoreContext): object;
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
