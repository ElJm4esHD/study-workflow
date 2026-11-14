import { isValidDate, isValidTime } from '../../core/shared/dates.ts';
import { nameKey } from '../../core/shared/normalize.ts';
import { findTagged } from '../../core/shared/tagged.ts';

export type FinalDate = { id: string; materiaId: string; date: string; time: string | null };
export type Chosen = { materiaId: string; eventId: string; date: string; time: string | null };
export type FinalsData = { dates: FinalDate[]; chosen: Chosen[] };

// ---- Formato de importación (docs/formato-finales.md) ----

export type ParsedMateria = { name: string; fechas: { fecha: string; hora: string | null }[]; errors: string[] };
export type FinalesParse = { ok: true; materias: ParsedMateria[] } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseFinales(text: string): FinalesParse {
  const obj = findTagged(text, 'finales');
  if (!obj) return { ok: false, error: 'No encontré fechas de finales en el texto pegado.' };
  if (obj.version !== 1) return { ok: false, error: `Versión de finales no soportada (${obj.version}). Actualizá la app.` };
  if (!Array.isArray(obj.materias) || obj.materias.length === 0) return { ok: false, error: 'No hay materias en el texto pegado.' };
  return {
    ok: true,
    materias: obj.materias.map((raw: unknown): ParsedMateria => {
      const out: ParsedMateria = { name: '', fechas: [], errors: [] };
      if (!isObj(raw)) { out.errors.push('La materia no es un objeto.'); return out; }
      if (typeof raw.materia === 'string' && raw.materia.trim()) out.name = raw.materia.trim();
      else out.errors.push('Falta el nombre de la materia.');
      const seen = new Set<string>();
      for (const f of Array.isArray(raw.fechas) ? raw.fechas : []) {
        const fecha = isObj(f) ? f.fecha : undefined;
        const hora = isObj(f) ? f.hora ?? null : null;
        if (!isValidDate(fecha)) { out.errors.push(`Fecha inválida (usar AAAA-MM-DD): "${fecha}".`); continue; }
        if (hora !== null && !isValidTime(hora)) { out.errors.push(`Hora inválida (usar HH:MM): "${hora}".`); continue; }
        const k = `${fecha} ${hora}`;
        if (!seen.has(k)) { seen.add(k); out.fechas.push({ fecha, hora }); }
      }
      if (!out.fechas.length) out.errors.push('La materia no tiene fechas válidas.');
      return out;
    }),
  };
}

/** Materia que corresponde a un nombre del JSON: por nombre o por sigla, sin mayúsculas ni tildes. */
export function matchMateria<M extends { id: string; name: string; sigla: string; archived: boolean }>(name: string, materias: M[]): M | undefined {
  const k = nameKey(name);
  const active = materias.filter((m) => !m.archived);
  return active.find((m) => nameKey(m.name) === k) ?? active.find((m) => nameKey(m.sigla) === k);
}

// ---- Combinaciones ----

export const ORDENES = [
  { id: 'separacion', label: 'Más días entre finales' }, { id: 'termina', label: 'Termina antes' }, { id: 'empieza', label: 'Empieza más tarde' },
] as const;
export type Orden = (typeof ORDENES)[number]['id'];
export type Filters = { minDias: number; antes: string | null; excluir: { from: string; to: string }[]; orden: Orden };
export type Combo = { picks: FinalDate[]; gaps: number[]; minGap: number | null; first: string; last: string };

export const daysBetween = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Una fecha por materia. Poda por filtros mientras arma el producto; `cap` evita colgar el navegador. */
export function combos(groups: FinalDate[][], f: Filters, cap = 20_000): { list: Combo[]; truncated: boolean } {
  const ok = (d: FinalDate) => (!f.antes || d.date <= f.antes) && !f.excluir.some((r) => d.date >= r.from && d.date <= r.to);
  const opts = groups.map((g) => g.filter(ok));
  const list: Combo[] = [];
  const cur: FinalDate[] = [];
  let truncated = false;
  const walk = (i: number) => {
    if (truncated) return;
    if (i === opts.length) {
      if (list.length >= cap) { truncated = true; return; }
      const picks = [...cur].sort((a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`));
      const gaps = picks.slice(1).map((p, k) => daysBetween(picks[k]!.date, p.date));
      list.push({ picks, gaps, minGap: gaps.length ? Math.min(...gaps) : null, first: picks[0]!.date, last: picks.at(-1)!.date });
      return;
    }
    for (const d of opts[i]!) {
      if (cur.every((c) => Math.abs(daysBetween(c.date, d.date)) >= f.minDias)) { cur.push(d); walk(i + 1); cur.pop(); }
    }
  };
  if (opts.length) walk(0);
  const gap = (c: Combo) => c.minGap ?? Infinity;
  const by: Record<Orden, (a: Combo, b: Combo) => number> = {
    separacion: (a, b) => gap(b) - gap(a) || a.last.localeCompare(b.last),
    termina: (a, b) => a.last.localeCompare(b.last) || gap(b) - gap(a),
    empieza: (a, b) => b.first.localeCompare(a.first) || gap(b) - gap(a),
  };
  return { list: list.sort(by[f.orden]), truncated };
}
