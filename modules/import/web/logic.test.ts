import { describe, expect, it } from 'vitest';
import { deleteCounts, neededMaterias } from './logic.ts';
import type { Preview } from '../server/preview.ts';

const it0 = { tipo: 'tarea', fecha: '2026-11-05', hora: null, titulo: 't', notas: null, duracion: null, categoria: 'tarea' as const, errors: [], materiaId: null, materiaArchived: false, duplicate: false };
describe('import logic', () => {
  it('solo pide materias de ítems tildados', () => {
    const p: Preview = {
      plan: { title: null, materia: null },
      items: [{ ...it0, index: 0, materiaName: 'Álgebra' }, { ...it0, index: 1, materiaName: 'Física' }],
      unresolvedMaterias: [{ key: 'algebra', name: 'Álgebra' }, { key: 'fisica', name: 'Física' }],
    };
    expect(neededMaterias(p, new Set([0])).map((u) => u.key)).toEqual(['algebra']);
    expect(neededMaterias(p, new Set())).toEqual([]);
  });
  it('cuenta eventos según mantener exámenes', () => {
    const s = { id: 'x', title: null, createdAt: '', tasksDone: 1, tasksTotal: 4, eventsCount: 2, examsCount: 1 };
    expect(deleteCounts(s, true)).toEqual({ pending: 3, events: 2 });
    expect(deleteCounts(s, false)).toEqual({ pending: 3, events: 3 });
  });
});
