export const VIEWS = [
  { id: 'mes', label: 'Mes', fc: 'dayGridMonth' },
  { id: 'semana', label: 'Semana', fc: 'timeGridWeek' },
  { id: 'agenda', label: 'Agenda', fc: 'agenda' },
] as const;

export const KIND_LABELS = { evento: 'Evento', parcial: 'Parcial', recuperatorio: 'Recuperatorio', final: 'Final' } as const;
