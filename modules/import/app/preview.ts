import { nameKey } from '../../../core/shared/normalize.ts';
import type { Materia } from '../../../core/app/registry.ts';
import type { CalendarEvent } from '../../calendar/app/service.ts';
import type { TodoItem } from '../../todo/app/service.ts';
import type { ParsedItem, ParseResult } from './parser.ts';

export type PreviewItem = ParsedItem & { materiaId: string | null; materiaArchived: boolean; duplicate: boolean };
export type Preview = {
  plan: { title: string | null; materia: string | null };
  items: PreviewItem[];
  unresolvedMaterias: { key: string; name: string }[];
};

export function buildPreview(
  parsed: Extract<ParseResult, { ok: true }>,
  deps: { materias: Materia[]; todos: TodoItem[]; events: CalendarEvent[] },
): Preview {
  const byKey = new Map(deps.materias.map((m) => [nameKey(m.name), m]));
  const unresolved = new Map<string, string>();
  const dupKey = (fecha: string, titulo: string, materia: string) => `${fecha}|${nameKey(titulo)}|${materia}`;
  const seen = new Set<string>();
  for (const t of deps.todos) if (t.dueDate) seen.add(dupKey(t.dueDate, t.title, t.materiaId ?? ''));
  for (const e of deps.events) if (!e.repeatWeekdays) seen.add(dupKey(e.startDate, e.title, e.materiaId ?? ''));

  const items = parsed.items.map((it): PreviewItem => {
    const key = it.materiaName ? nameKey(it.materiaName) : null;
    const m = key ? byKey.get(key) : undefined;
    if (key && !m && !unresolved.has(key)) unresolved.set(key, it.materiaName!);
    const dk = dupKey(it.fecha, it.titulo, m?.id ?? (key ? 'nueva:' + key : ''));
    const duplicate = !it.errors.length && seen.has(dk);
    if (!it.errors.length) seen.add(dk);
    return { ...it, materiaId: m?.id ?? null, materiaArchived: m?.archived ?? false, duplicate };
  });
  return { plan: parsed.plan, items, unresolvedMaterias: [...unresolved].map(([key, name]) => ({ key, name })) };
}
