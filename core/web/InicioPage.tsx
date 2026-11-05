import { weekdayOf, todayAR } from '../shared/dates.ts';
import { useCore } from './CoreContext.tsx';
import { dashboardCards } from './registry.ts';

const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "Jueves 5 de noviembre" */
export function longDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  const w = DAYS[weekdayOf(date) - 1];
  return `${w[0].toUpperCase()}${w.slice(1)} ${d} de ${MONTHS[m - 1]}`;
}

export function InicioPage() {
  const { enabledModules } = useCore();
  const { all, left, right } = dashboardCards(enabledModules);
  return (
    <>
      <h1 className="page-title">{longDate(todayAR())}</h1>
      {all.length === 0 ? <p className="muted">Activá módulos en Ajustes.</p> : (
        <div className="dash">
          <div className="dash-all">{all.map(({ id, Card }) => <Card key={id} />)}</div>
          <div className="dash-col">{left.map(({ id, Card }) => <Card key={id} />)}</div>
          <div className="dash-col">{right.map(({ id, Card }) => <Card key={id} />)}</div>
        </div>
      )}
    </>
  );
}
