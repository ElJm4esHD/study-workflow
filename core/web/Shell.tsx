import type { ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router';
import type { Connection } from './api.ts';
import { useCore } from './CoreContext.tsx';
import { materiaVars } from './MateriaChip.tsx';
import { HomeIcon, SettingsIcon } from './icons.tsx';

const stamp = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
function offlineText({ copyAt, pending }: Connection) {
  const when = copyAt ? ` Datos del ${stamp.format(new Date(copyAt)).replace(',', '')}` : '';
  const n = pending ? `, ${pending} ${pending === 1 ? 'cambio' : 'cambios'} por sincronizar` : '';
  return `Sin conexión.${when}${n}.`;
}

export function Shell() {
  const { enabledModules, materias, connection } = useCore();
  const items: { key: string; to: string; label: string; Icon: ComponentType }[] = [{ key: 'inicio', to: '/', label: 'Inicio', Icon: HomeIcon }];
  enabledModules
    .filter((m) => m.nav)
    .sort((a, b) => a.nav!.order - b.nav!.order)
    .forEach((m) => items.push({ key: m.id, to: m.nav!.path, label: m.name, Icon: m.icon }));
  items.push({ key: 'ajustes', to: '/ajustes', label: 'Ajustes', Icon: SettingsIcon });
  return (
    <div className="shell">
      {connection.offline && <div className="offline-bar" role="status">{offlineText(connection)}</div>}
      <nav className="nav" aria-label="Principal">
        <div className="brand">Study Workflow</div>
        <div className="nav-links">
          {items.map(({ key, to, label, Icon }) => (
            <NavLink key={key} to={to} end={to === '/'} className="nav-item">
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
        <div className="legend" aria-label="Materias">
          {materias.filter((m) => !m.archived).map((m) => (
            <span key={m.id}><i className="dot" style={materiaVars(m.color)} aria-hidden="true" />{m.name}</span>
          ))}
        </div>
      </nav>
      <main className="main"><Outlet /></main>
    </div>
  );
}
