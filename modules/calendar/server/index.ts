import type { ServerModule } from '../../../core/server/registry.ts';
import { makeCalendar } from './service.ts';

export const calendar: ServerModule = {
  id: 'calendar',
  migrationsDir: new URL('./migrations/', import.meta.url),
  service: (ctx) => makeCalendar(ctx),
  async routes() {}, // las rutas llegan en la Task 13
};
