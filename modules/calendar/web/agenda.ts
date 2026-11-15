import { api } from '../../../core/web/api.ts';
import type { AgendaData } from './summary.ts';

export const loadAgenda = (from: string, to: string): Promise<AgendaData> =>
  api<AgendaData>('GET', `/api/calendar/agenda?from=${from}&to=${to}`);
