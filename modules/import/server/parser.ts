import { TODO_CATEGORIES, type TodoCategory } from '../../todo/shared.ts';
import { isValidDate, isValidTime } from '../../../core/shared/dates.ts';
import { findTagged } from '../../../core/shared/tagged.ts';

export const ITEM_TIPOS = ['tarea', 'evento', 'parcial', 'recuperatorio', 'final'] as const;

export type ParsedItem = {
  index: number;
  tipo: string;
  fecha: string;
  hora: string | null;
  titulo: string;
  notas: string | null;
  duracion: number | null;
  categoria: TodoCategory;
  subtareas: string[];
  materiaName: string | null;
  errors: string[];
};
export type ParseResult =
  | { ok: true; plan: { title: string | null; materia: string | null }; items: ParsedItem[] }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const findPlanObject = (text: string) => findTagged(text, 'plan');

function parseItem(raw: unknown, index: number, planMateria: string | null): ParsedItem {
  const out: ParsedItem = { index, tipo: '', fecha: '', hora: null, titulo: '', notas: null, duracion: null, categoria: 'tarea', subtareas: [], materiaName: null, errors: [] };
  if (!isObj(raw)) {
    out.errors.push('El ítem no es un objeto.');
    return out;
  }
  if ((ITEM_TIPOS as readonly unknown[]).includes(raw.tipo)) out.tipo = raw.tipo as string;
  else out.errors.push(`Tipo inválido: "${raw.tipo}".`);

  if (isValidDate(raw.fecha)) out.fecha = raw.fecha;
  else out.errors.push('Fecha inválida (usar AAAA-MM-DD).');

  const titulo = typeof raw.titulo === 'string' ? raw.titulo.trim() : '';
  if (!titulo) out.errors.push('Falta el título.');
  else if (titulo.length > 120) out.errors.push('El título supera los 120 caracteres.');
  else out.titulo = titulo;

  if (raw.hora != null) {
    if (isValidTime(raw.hora)) out.hora = raw.hora;
    else out.errors.push('Hora inválida (usar HH:MM).');
  }
  if (raw.notas != null) {
    if (typeof raw.notas === 'string') out.notas = raw.notas;
    else out.errors.push('Las notas tienen que ser texto.');
  }
  // Solo las tareas usan duración, categoría y subtareas; en el resto se ignoran.
  if (raw.tipo === 'tarea') {
    if (raw.duracion != null) {
      const d = raw.duracion;
      if (typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 1440) out.duracion = d;
      else out.errors.push('Duración inválida (minutos enteros entre 1 y 1440).');
    }
    if (raw.categoria != null) {
      const c = TODO_CATEGORIES.find((x) => x.id === raw.categoria);
      if (c) out.categoria = c.id;
      else out.errors.push(`Categoría inválida: "${raw.categoria}".`);
    }
    if (raw.subtareas != null) {
      const s = raw.subtareas;
      if (Array.isArray(s) && s.length <= 50 && s.every((x) => typeof x === 'string' && x.trim() && x.trim().length <= 120)) out.subtareas = s.map((x: string) => x.trim());
      else out.errors.push('Subtareas inválidas (lista de hasta 50 textos de hasta 120 caracteres).');
    }
  }
  if (raw.materia != null && typeof raw.materia !== 'string') out.errors.push('La materia tiene que ser texto.');
  out.materiaName = typeof raw.materia === 'string' ? raw.materia : planMateria;
  return out;
}

export function parsePlanText(text: string): ParseResult {
  const obj = findPlanObject(text);
  if (!obj) return { ok: false, error: 'No encontré un plan en el texto pegado.' };
  if (obj.version !== 1 && obj.version !== 2 && obj.version !== 3) return { ok: false, error: `Versión de plan no soportada (${obj.version}). Actualizá la app.` };
  if (!Array.isArray(obj.items) || obj.items.length === 0) return { ok: false, error: 'El plan no tiene ítems.' };
  const title = typeof obj.titulo === 'string' ? obj.titulo : null;
  const materia = typeof obj.materia === 'string' ? obj.materia : null;
  return { ok: true, plan: { title, materia }, items: obj.items.map((it, i) => parseItem(it, i, materia)) };
}
