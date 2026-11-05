import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/web/api.ts';
import type { AgendaData } from './summary.ts';

const m = vi.hoisted(() => ({ api: vi.fn(), readCopy: vi.fn() }));
vi.mock('../../../core/web/api.ts', async (orig) => ({ ...(await orig<object>()), api: m.api }));
vi.mock('../../../core/web/offline.ts', () => ({ readCopy: m.readCopy }));
const { sliceAgenda, loadAgenda, rememberWide, wideAgendaUrl } = await import('./agenda.ts');

const ev = (startDate: string, endDate: string) => ({ startDate, endDate }) as AgendaData['events'][number];
const td = (dueDate: string | null) => ({ dueDate }) as AgendaData['todos'][number];

describe('agenda offline', () => {
  beforeEach(() => {
    const s = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => void s.set(k, v) });
    m.api.mockReset(); m.readCopy.mockReset();
  });

  it('sliceAgenda: evento 10..12 entra en rango 11..11; to-do del 13 queda afuera', () => {
    const r = sliceAgenda({ events: [ev('2026-11-10', '2026-11-12')], todos: [td('2026-11-13'), td('2026-11-11')] }, '2026-11-11', '2026-11-11');
    expect(r.events).toHaveLength(1);
    expect(r.todos.map((t) => t.dueDate)).toEqual(['2026-11-11']);
  });

  it('sliceAgenda: to-do sin dueDate queda afuera', () => {
    expect(sliceAgenda({ events: [], todos: [td(null)] }, '2026-01-01', '2026-12-31').todos).toEqual([]);
  });

  it('loadAgenda offline usa la copia ancha aunque la URL pedida sea otra', async () => {
    const url = rememberWide('2026-11-05');
    expect(url).toBe(wideAgendaUrl('2026-11-05'));
    m.api.mockRejectedValue(new ApiError(0, 'sin_conexion', 'x'));
    m.readCopy.mockImplementation((u: string) => u === url ? { data: { events: [ev('2026-10-01', '2026-10-01')], todos: [td('2026-11-20')] }, at: '' } : undefined);
    const r = await loadAgenda('2026-11-20', '2026-11-20');
    expect(r.events).toEqual([]);
    expect(r.todos).toHaveLength(1);
  });

  it('loadAgenda offline sin copia relanza el error', async () => {
    m.api.mockRejectedValue(new ApiError(0, 'sin_conexion', 'x'));
    await expect(loadAgenda('2026-11-20', '2026-11-20')).rejects.toThrow('x');
  });
});
