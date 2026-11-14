import { useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { m } from 'motion/react';
import type { Connection } from './api.ts';
import { useCore } from './CoreContext.tsx';
import { BookIcon, ChevronRightIcon, HomeIcon, MoreIcon, SettingsIcon } from './icons.tsx';
import { useMotion } from './motion.tsx';
import { Sheet } from './ui.tsx';

const stamp = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
function offlineText({ copyAt, pending }: Connection) {
  const when = copyAt ? ` Datos del ${stamp.format(new Date(copyAt)).replace(',', '')}` : '';
  const n = pending ? `, ${pending} ${pending === 1 ? 'cambio' : 'cambios'} por sincronizar` : '';
  return `Sin conexión.${when}${n}.`;
}

type Item = { key: string; to: string; label: string; Icon: ComponentType; more: boolean };
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function Shell() {
  const { enabledModules, connection } = useCore();
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { spring } = useMotion();

  const items: Item[] = [{ key: 'inicio', to: '/', label: 'Inicio', Icon: HomeIcon, more: false }];
  enabledModules
    .filter((x) => x.nav)
    .sort((a, b) => a.nav!.order - b.nav!.order)
    .forEach((x) => items.push({ key: x.id, to: x.nav!.path, label: x.name, Icon: x.icon, more: !!x.nav!.more }));
  items.push({ key: 'ajustes', to: '/ajustes', label: 'Ajustes', Icon: SettingsIcon, more: true });

  const main = items.filter((i) => !i.more);
  const faculty = items.filter((i) => i.more && i.key !== 'ajustes');
  const settings = items[items.length - 1]!;
  const moreItems = items.filter((i) => i.more);
  const inMore = moreItems.some((i) => pathname.startsWith(i.to));
  const hasTodo = enabledModules.some((x) => x.id === 'todo');
  const section = pathname.split('/')[1] ?? '';

  // Atajos de teclado (compu): 1…n pantallas, N tarea nueva.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || moreOpen) return;
      const n = Number(e.key);
      if (n >= 1 && n <= items.length) navigate(items[n - 1]!.to);
      else if (e.key.toLowerCase() === 'n' && hasTodo) { e.preventDefault(); navigate('/todo/nueva'); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [items.map((i) => i.to).join(), hasTodo, moreOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const side = (i: Item) => (
    <NavLink key={i.key} to={i.to} end={i.to === '/'} className="side-item">
      <i.Icon /><span>{i.label}</span><kbd className="kbd">{items.indexOf(i) + 1}</kbd>
    </NavLink>
  );

  return (
    <div className="shell">
      {connection.offline && <div className="offline-bar" role="status">{offlineText(connection)}</div>}
      <aside className="side" aria-label="Principal">
        <div className="brand"><i><BookIcon size={16} /></i>Study Workflow</div>
        <div className="eyebrow">Principal</div>
        {main.map(side)}
        {faculty.length > 0 && <><div className="eyebrow">Facultad</div>{faculty.map(side)}</>}
        <div className="bottom">{side(settings)}</div>
      </aside>
      <nav className="nav" aria-label="Principal">
        {main.map(({ key, to, label, Icon }) => (
          <NavLink key={key} to={to} end={to === '/'} className="nav-item">
            <span className="nav-pill"><Icon /></span><span>{label}</span>
          </NavLink>
        ))}
        <button type="button" className="nav-item" aria-current={inMore ? 'page' : undefined} aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
          <span className="nav-pill"><MoreIcon /></span><span>Más</span>
        </button>
      </nav>
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label="Más">
        <div className="eyebrow sheet-title">Más</div>
        <ul className="more-list">
          {moreItems.map(({ key, to, label, Icon }) => (
            <li key={key}>
              <NavLink to={to} onClick={() => setMoreOpen(false)}><span className="mi"><Icon /></span><span>{label}</span><ChevronRightIcon size={18} /></NavLink>
            </li>
          ))}
        </ul>
      </Sheet>
      <main className="main">
        <m.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring('gentle')}>
          <Outlet />
        </m.div>
      </main>
    </div>
  );
}
