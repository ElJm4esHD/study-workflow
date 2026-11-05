import type { WebModule } from '../../../core/web/registry.ts';
import { CalendarIcon } from '../../../core/web/icons.tsx';
import { CalendarPage } from './CalendarPage.tsx';
import { EventEditPage } from './EventEditPage.tsx';
import { CalendarSettings } from './CalendarSettings.tsx';

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
};
