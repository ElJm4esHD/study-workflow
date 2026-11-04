import { NavLink, Outlet } from 'react-router';
import { useCore } from './CoreContext.tsx';
import { SettingsIcon } from './icons.tsx';

export function Shell() {
  const { enabledModules } = useCore();
  const items = enabledModules
    .filter((m) => m.nav)
    .sort((a, b) => a.nav!.order - b.nav!.order)
    .map((m) => ({ key: m.id, to: m.nav!.path, label: m.name, Icon: m.icon }));
  items.push({ key: 'ajustes', to: '/ajustes', label: 'Ajustes', Icon: SettingsIcon });
  return (
    <div className="shell">
      <nav className="nav" aria-label="Principal">
        {items.map(({ key, to, label, Icon }) => (
          <NavLink key={key} to={to} className="nav-item">
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main"><Outlet /></main>
    </div>
  );
}
