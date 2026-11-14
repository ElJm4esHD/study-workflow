import { weekdayOf, todayAR } from '../shared/dates.ts';
import { useCore } from './CoreContext.tsx';
import { dashboardCards } from './registry.ts';
import { Link } from 'react-router';
import { SettingsIcon } from './icons.tsx';
import { EmptyState, PageHeader } from './ui.tsx';

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
      <PageHeader title={longDate(todayAR())} />
      {all.length === 0 ? <EmptyState icon={SettingsIcon} title="Inicio vacío" action={<Link className="btn" to="/ajustes">Ir a Ajustes</Link>}>Activá módulos para ver tus tarjetas.</EmptyState> : (
        <div className="dash">
          <div className="dash-all">{all.map(({ id, Card }) => <Card key={id} />)}</div>
          <div className="dash-col">{left.map(({ id, Card }) => <Card key={id} />)}</div>
          <div className="dash-col">{right.map(({ id, Card }) => <Card key={id} />)}</div>
        </div>
      )}
    </>
  );
}
