import type { ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useCore } from './CoreContext.tsx';
import { materiaVars } from './MateriaChip.tsx';
import { HomeIcon, SettingsIcon } from './icons.tsx';

export function Shell() {
  const { enabledModules, materias } = useCore();
  const items: { key: string; to: string; label: string; Icon: ComponentType }[] = [{ key: 'inicio', to: '/', label: 'Inicio', Icon: HomeIcon }];
  enabledModules
    .filter((m) => m.nav)
    .sort((a, b) => a.nav!.order - b.nav!.order)
    .forEach((m) => items.push({ key: m.id, to: m.nav!.path, label: m.name, Icon: m.icon }));
  items.push({ key: 'ajustes', to: '/ajustes', label: 'Ajustes', Icon: SettingsIcon });
  return (
    <div className="shell">
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
