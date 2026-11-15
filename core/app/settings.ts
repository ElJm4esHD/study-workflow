import type { Collection, SettingsService } from './registry.ts';

/** Un registro por ajuste: dos ajustes distintos cambiados en dos dispositivos no se pisan. */
type Doc = { id: string; value: unknown };

export function makeSettings(col: Collection<Doc>): SettingsService {
  return {
    getAll: () => Object.fromEntries(col.all().map((d) => [d.id, d.value])),
    get: <T,>(key: string, fallback: T): T => (col.get(key) ? (col.get(key)!.value as T) : fallback),
    set: (key, value) => col.put({ id: key, value }),
  };
}
