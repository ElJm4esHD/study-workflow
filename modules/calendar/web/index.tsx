import type { WebModule } from '../../../core/web/registry.ts';
import { CalendarIcon } from '../../../core/web/icons.tsx';
import { CalendarPage } from './CalendarPage.tsx';
import { EventEditPage } from './EventEditPage.tsx';
import { CalendarSettings } from './CalendarSettings.tsx';
import { rememberWide } from './agenda.ts';
import { todayAR } from '../../../core/shared/dates.ts';
import { ExamCard, WeekCard } from './cards.tsx';

export const calendar: WebModule = {
  id: 'calendar',
  name: 'Calendario',
  icon: CalendarIcon,
  nav: { path: '/calendario', order: 20 },
  settings: CalendarSettings,
  routes: [
    { path: '/calendario', element: <CalendarPage /> },
    { path: '/calendario/evento/nuevo', element: <EventEditPage /> },
    { path: '/calendario/evento/:id', element: <EventEditPage /> },
  ],
  prefetch: () => [rememberWide(todayAR())],
  dashboard: [{ id: 'examen', order: 10, column: 'left', Card: ExamCard }, { id: 'semana', order: 30, column: 'left', Card: WeekCard }],
};
