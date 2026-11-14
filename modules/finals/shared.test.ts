import { expect, test } from 'vitest';
import { combos, matchMateria, parseFinales, type FinalDate, type Filters } from './shared.ts';

const d = (materiaId: string, date: string, time: string | null = null): FinalDate => ({ id: `${materiaId}-${date}`, materiaId, date, time });
const F: Filters = { minDias: 0, antes: null, excluir: [], orden: 'separacion' };
const A = [d('a', '2026-12-01'), d('a', '2026-12-10')];
const B = [d('b', '2026-12-03'), d('b', '2026-12-17')];

test('combos: producto, orden por separación y métricas', () => {
  const { list } = combos([A, B], F);
  expect(list).toHaveLength(4);
  expect(list[0]).toMatchObject({ minGap: 16, first: '2026-12-01', last: '2026-12-17' });
  expect(list[0]!.picks.map((p) => p.id)).toEqual(['a-2026-12-01', 'b-2026-12-17']);
  expect(list.at(-1)!.minGap).toBe(2);
});

test('combos: filtros y otros órdenes', () => {
  expect(combos([A, B], { ...F, minDias: 7 }).list.map((c) => c.minGap)).toEqual([16, 7, 7]);
  expect(combos([A, B], { ...F, antes: '2026-12-10' }).list.every((c) => c.last <= '2026-12-10')).toBe(true);
  expect(combos([A, B], { ...F, excluir: [{ from: '2026-12-01', to: '2026-12-05' }] }).list).toHaveLength(1);
  expect(combos([A, B], { ...F, orden: 'termina' }).list[0]!.last).toBe('2026-12-03');
  expect(combos([A, B], { ...F, orden: 'empieza' }).list[0]!.first).toBe('2026-12-10');
});

test('combos: bordes', () => {
  expect(combos([], F).list).toEqual([]);
  expect(combos([A, []], F).list).toEqual([]);
  expect(combos([A], F).list[0]!.minGap).toBeNull();
  expect(combos([A, B], F, 2)).toMatchObject({ truncated: true });
  // minDias 1: no dos finales el mismo día
  expect(combos([[d('a', '2026-12-01')], [d('b', '2026-12-01')]], { ...F, minDias: 1 }).list).toEqual([]);
});

test('parseFinales: texto alrededor, errores por materia y duplicados', () => {
  const json = JSON.stringify({
    studyWorkflow: 'finales', version: 1, materias: [
      { materia: ' Álgebra ', fechas: [{ fecha: '2026-12-03', hora: '09:00' }, { fecha: '2026-12-03', hora: '09:00' }, { fecha: '2026-12-10' }, { fecha: '2026-02-30' }, { fecha: '2026-12-11', hora: '25:00' }] },
      { fechas: [] },
    ],
  });
  const r = parseFinales('Acá va:\n```json\n' + json + '\n```');
  if (!r.ok) throw new Error(r.error);
  expect(r.materias[0]).toMatchObject({ name: 'Álgebra', fechas: [{ fecha: '2026-12-03', hora: '09:00' }, { fecha: '2026-12-10', hora: null }] });
  expect(r.materias[0]!.errors).toHaveLength(2);
  expect(r.materias[1]!.errors).toEqual(['Falta el nombre de la materia.', 'La materia no tiene fechas válidas.']);
});

test('parseFinales: errores generales', () => {
  expect(parseFinales('hola')).toMatchObject({ ok: false });
  expect(parseFinales('{"studyWorkflow":"plan","version":2,"items":[]}')).toMatchObject({ ok: false });
  expect(parseFinales('{"studyWorkflow":"finales","version":2,"materias":[]}')).toEqual({ ok: false, error: 'Versión de finales no soportada (2). Actualizá la app.' });
});

test('matchMateria: nombre o sigla, sin archivadas', () => {
  const ms = [{ id: '1', name: 'Álgebra', sigla: 'ALG', archived: false }, { id: '2', name: 'Física', sigla: 'FIS', archived: true }];
  expect(matchMateria('algebra', ms)?.id).toBe('1');
  expect(matchMateria('alg', ms)?.id).toBe('1');
  expect(matchMateria('Física', ms)).toBeUndefined();
});
