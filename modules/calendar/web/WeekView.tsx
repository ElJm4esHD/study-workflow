import { useImperativeHandle, type ComponentProps, type Ref } from 'react';
import FullCalendar, { useCalendarController } from '@fullcalendar/react';
import type { DatesSetInfo, EventDisplayInfo, EventInput } from '@fullcalendar/react';
import classicTheme from '@fullcalendar/react/themes/classic';
import dayGrid from '@fullcalendar/react/daygrid';
import timeGrid from '@fullcalendar/react/timegrid';
import interaction from '@fullcalendar/react/interaction';
import es from '@fullcalendar/react/locales/es';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';

/** Vista Semana (FullCalendar). Vive aparte para que la librería se baje solo cuando se abre Semana, no al arrancar la app. */
type FC = ComponentProps<typeof FullCalendar>;
export type WeekApi = { prev(): void; next(): void; today(): void };

export default function WeekView({ api, view, date, wide, events, content, onDates, onDateClick, onEventClick }: {
  api: Ref<WeekApi>; view: string; date: string; wide: boolean; events: EventInput[];
  content(i: EventDisplayInfo): React.ReactNode; onDates(i: DatesSetInfo): void; onDateClick: NonNullable<FC['dateClick']>; onEventClick: NonNullable<FC['eventClick']>;
}) {
  const controller = useCalendarController();
  useImperativeHandle(api, () => ({ prev: () => controller.prev(), next: () => controller.next(), today: () => controller.today() }), [controller]);
  return (
    <FullCalendar
      controller={controller}
      plugins={[classicTheme, dayGrid, timeGrid, interaction]}
      locale={es}
      firstDay={1}
      headerToolbar={false}
      initialView={view}
      initialDate={date}
      height={wide ? '100%' : 'auto'}
      scrollTime="07:00:00"
      noEventsText="No hay nada en estas fechas."
      events={events}
      eventContent={content}
      datesSet={onDates}
      dateClick={onDateClick}
      eventClick={onEventClick}
    />
  );
}
