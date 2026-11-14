import { describe, expect, test } from 'vitest';
import { parsePlanText } from './parser.ts';

const plan = (items: unknown[] | undefined, extra = {}) =>
  JSON.stringify({ studyWorkflow: 'plan', version: 1, items, ...extra });
const item = (o = {}) => ({ tipo: 'tarea', fecha: '2026-11-10', titulo: 'Leer', ...o });
const ok = (t: string) => {
  const r = parsePlanText(t);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('parsePlanText', () => {
  test('JSON solo', () => {
    const r = ok(plan([item()]));
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.errors).toEqual([]);
    expect(r.items[0]!.hora).toBeNull();
    expect(r.items[0]!.notas).toBeNull();
  });
  test('con texto alrededor y fences', () => {
    expect(ok('Acá va tu plan:\n```json\n' + plan([item()]) + '\n```\n¡Éxitos!').items).toHaveLength(1);
  });
  test('llaves sueltas y otro JSON antes del plan', () => {
    expect(ok('Usá {fecha} así: {"a":1} y ' + plan([item()])).items).toHaveLength(1);
  });
  test('JSON roto → error sin plan', () => {
    expect(parsePlanText('{"studyWorkflow":"plan",')).toEqual({ ok: false, error: 'No encontré un plan en el texto pegado.' });
  });
  test('objeto sin studyWorkflow → error sin plan', () => {
    expect(parsePlanText('{"items":[]}')).toEqual({ ok: false, error: 'No encontré un plan en el texto pegado.' });
  });
  test('versiones 2 y 3 se aceptan; la 4 no', () => {
    expect(ok(plan([item()], { version: 2 })).items).toHaveLength(1);
    expect(ok(plan([item()], { version: 3 })).items).toHaveLength(1);
    expect(parsePlanText(plan([item()], { version: 4 }))).toEqual({
      ok: false,
      error: 'Versión de plan no soportada (4). Actualizá la app.',
    });
  });
  test('subtareas: solo en tareas, lista de textos', () => {
    const r = ok(plan([
      item({ subtareas: [' 1.2 ', '1.3'] }), item(), item({ tipo: 'parcial', subtareas: [1] }),
      item({ subtareas: ['ok', ''] }), item({ subtareas: 'no' }),
    ], { version: 3 }));
    expect(r.items.map((i) => i.subtareas)).toEqual([['1.2', '1.3'], [], [], [], []]);
    expect(r.items.map((i) => i.errors.length)).toEqual([0, 0, 0, 1, 1]);
    expect(r.items[3]!.errors[0]).toBe('Subtareas inválidas (lista de hasta 50 textos de hasta 120 caracteres).');
  });
  test('duracion y categoria en una tarea', () => {
    const r = ok(plan([item({ duracion: 45, categoria: 'estudio' }), item()], { version: 2 }));
    expect(r.items[0]).toMatchObject({ duracion: 45, categoria: 'estudio', errors: [] });
    expect(r.items[1]).toMatchObject({ duracion: null, categoria: 'tarea' });
  });
  test('duracion inválida', () => {
    for (const duracion of ['45', 45.5, 0, 1441]) {
      expect(ok(plan([item({ duracion })], { version: 2 })).items[0]!.errors).toEqual(['Duración inválida (minutos enteros entre 1 y 1440).']);
    }
  });
  test('categoria inválida en una tarea', () => {
    expect(ok(plan([item({ categoria: 'examen' })], { version: 2 })).items[0]!.errors).toEqual(['Categoría inválida: "examen".']);
  });
  test('duracion/categoria en un parcial se ignoran', () => {
    const it = ok(plan([item({ tipo: 'parcial', duracion: 'x', categoria: 'examen' })], { version: 2 })).items[0]!;
    expect(it.errors).toEqual([]);
    expect(it).toMatchObject({ duracion: null, categoria: 'tarea' });
  });
  test('plan v1 con duracion se lee igual', () => {
    expect(ok(plan([item({ duracion: 30 })])).items[0]).toMatchObject({ duracion: 30, errors: [] });
  });
  test('items vacío o ausente', () => {
    const e = { ok: false, error: 'El plan no tiene ítems.' };
    expect(parsePlanText(plan([]))).toEqual(e);
    expect(parsePlanText(plan(undefined))).toEqual(e);
  });
  test('fecha inválida marca solo ese ítem', () => {
    const r = ok(plan([item({ fecha: '2026-02-30' }), item()]));
    expect(r.items[0]!.errors).toEqual(['Fecha inválida (usar AAAA-MM-DD).']);
    expect(r.items[0]!.fecha).toBe('');
    expect(r.items[1]!.errors).toEqual([]);
  });
  test('bisiesto', () => {
    const r = ok(plan([item({ fecha: '2028-02-29' }), item({ fecha: '2026-02-29' })]));
    expect(r.items[0]!.errors).toEqual([]);
    expect(r.items[1]!.errors).toHaveLength(1);
  });
  test('hora 24:00 inválida; ausente → null', () => {
    const r = ok(plan([item({ hora: '24:00' }), item(), item({ hora: '09:30' })]));
    expect(r.items[0]!.errors).toEqual(['Hora inválida (usar HH:MM).']);
    expect(r.items[0]!.hora).toBeNull();
    expect(r.items[1]!.hora).toBeNull();
    expect(r.items[2]!.hora).toBe('09:30');
  });
  test('título: 121 error, 120 ok, trim', () => {
    const r = ok(plan([item({ titulo: 'a'.repeat(121) }), item({ titulo: 'a'.repeat(120) }), item({ titulo: '  Hola  ' }), item({ titulo: '   ' })]));
    expect(r.items[0]!.errors).toEqual(['El título supera los 120 caracteres.']);
    expect(r.items[1]!.errors).toEqual([]);
    expect(r.items[2]!.titulo).toBe('Hola');
    expect(r.items[3]!.errors).toEqual(['Falta el título.']);
  });
  test('tipo desconocido', () => {
    expect(ok(plan([item({ tipo: 'foo' })])).items[0]!.errors).toEqual(['Tipo inválido: "foo".']);
  });
  test('ítem no objeto, notas y materia no texto', () => {
    const r = ok(plan([5, item({ notas: 3, materia: 4 })]));
    expect(r.items[0]!.errors).toEqual(['El ítem no es un objeto.']);
    expect(r.items[1]!.errors).toEqual(['Las notas tienen que ser texto.', 'La materia tiene que ser texto.']);
  });
  test('materia del ítem pisa la del plan; si no, hereda', () => {
    const r = ok(plan([item({ materia: 'Física' }), item()], { materia: 'Álgebra', titulo: 'Plan' }));
    expect(r.plan).toEqual({ title: 'Plan', materia: 'Álgebra' });
    expect(r.items.map((i) => i.materiaName)).toEqual(['Física', 'Álgebra']);
  });
  test('campos desconocidos se ignoran', () => {
    expect(ok(plan([item({ prioridad: 'alta' })])).items[0]!.errors).toEqual([]);
  });
  test('llaves dentro de strings no rompen el balanceo', () => {
    expect(ok(plan([item({ titulo: 'Guía {4}' })])).items[0]!.titulo).toBe('Guía {4}');
  });
});
