import { NOVEDADES } from './novedades.ts';
import { PageHeader } from './ui.tsx';

export function NovedadesPage() {
  return (
    <>
      <PageHeader title="Novedades" />
      <ul className="novedades">
        {NOVEDADES.map((n) => (
          <li key={n.version} className="card">
            <h2>{n.titulo}<small>Versión {n.version} · {n.fecha}</small></h2>
            <ul>{n.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </li>
        ))}
      </ul>
    </>
  );
}
