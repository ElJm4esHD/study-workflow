import { isValidDate, isValidTime } from '../../../core/shared/dates.ts';

export const ITEM_TIPOS = ['tarea', 'evento', 'parcial', 'recuperatorio', 'final'] as const;

export type ParsedItem = {
  index: number;
  tipo: string;
  fecha: string;
  hora: string | null;
  titulo: string;
  notas: string | null;
  materiaName: string | null;
  errors: string[];
};
export type ParseResult =
  | { ok: true; plan: { title: string | null; materia: string | null }; items: ParsedItem[] }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// shortcut: O(n^2) worst case on pathological text with many unbalanced '{'; fine for pasted chat messages.
export function findPlanObject(text: string): Record<string, unknown> | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0;
    let inStr = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (c === '\\') j++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try {
          const obj: unknown = JSON.parse(text.slice(i, j + 1));
          if (isObj(obj) && obj.studyWorkflow === 'plan') return obj;
        } catch {
          // not JSON; keep scanning
        }
        break;
      }
    }
  }
  return null;
}

function parseItem(raw: unknown, index: number, planMateria: string | null): ParsedItem {
  const out: ParsedItem = { index, tipo: '', fecha: '', hora: null, titulo: '', notas: null, materiaName: null, errors: [] };
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
  if (raw.materia != null && typeof raw.materia !== 'string') out.errors.push('La materia tiene que ser texto.');
  out.materiaName = typeof raw.materia === 'string' ? raw.materia : planMateria;
  return out;
}

export function parsePlanText(text: string): ParseResult {
  const obj = findPlanObject(text);
  if (!obj) return { ok: false, error: 'No encontré un plan en el texto pegado.' };
  if (obj.version !== 1) return { ok: false, error: `Versión de plan no soportada (${obj.version}). Actualizá la app.` };
  if (!Array.isArray(obj.items) || obj.items.length === 0) return { ok: false, error: 'El plan no tiene ítems.' };
  const title = typeof obj.titulo === 'string' ? obj.titulo : null;
  const materia = typeof obj.materia === 'string' ? obj.materia : null;
  return { ok: true, plan: { title, materia }, items: obj.items.map((it, i) => parseItem(it, i, materia)) };
}
