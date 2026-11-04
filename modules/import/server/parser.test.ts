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
  test('version 2', () => {
    expect(parsePlanText(plan([item()], { version: 2 }))).toEqual({
      ok: false,
      error: 'Versión de plan no soportada (2). Actualizá la app.',
    });
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
