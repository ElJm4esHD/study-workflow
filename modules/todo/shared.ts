export const TODO_CATEGORIES = [
  { id: 'tarea', label: 'Tarea' }, { id: 'entrega', label: 'Entrega' }, { id: 'estudio', label: 'Estudio' },
] as const;
export type TodoCategory = (typeof TODO_CATEGORIES)[number]['id'];
