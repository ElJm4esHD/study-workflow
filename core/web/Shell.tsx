import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { animate, m, useMotionValue } from 'motion/react';
import { vibrate } from './haptics.ts';
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
  const settings = items[items.length - 1]!;
  const moreItems = items.filter((i) => i.more);
  const inMore = moreItems.some((i) => pathname.startsWith(i.to));
  const hasTodo = enabledModules.some((x) => x.id === 'todo');
  const section = pathname.split('/')[1] ?? '';

  // Deslizar entre las secciones de la barra de abajo (celu): la pantalla sigue al dedo y la siguiente entra desde ese lado.
  const x = useMotionValue(0);
  const enter = useRef(0);
  const mainRef = useRef<HTMLElement>(null);
  const live = useRef({ idx: -1, tos: [] as string[], spring });
  live.current = { idx: main.findIndex((i) => i.to === pathname), tos: main.map((i) => i.to), spring };
  const from = enter.current;
  useLayoutEffect(() => { x.jump(0); enter.current = 0; }, [section, x]);
  useEffect(() => {
    const el = mainRef.current;
    if (!el || !matchMedia('(pointer: coarse)').matches) return;
    let x0 = 0, y0 = 0, st: 'off' | 'maybe' | 'on' = 'off', v = 0, last = { x: 0, t: 0 };
    // Gestos horizontales que ya tienen dueño: deslizar fila, cambiar de mes/semana, campos y tiras con scroll horizontal.
    const owned = (t: EventTarget | null) => {
      for (let n = t instanceof HTMLElement ? t : null; n && n !== el; n = n.parentElement) {
        if (n.matches('input, textarea, select, .row-inner, .cal-wrap, [data-noswipe]')) return true;
        if (n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true;
      }
      return false;
    };
    const start = (e: TouchEvent) => {
      st = live.current.idx < 0 || e.touches.length > 1 || document.querySelector('.sheet') || owned(e.target) ? 'off' : 'maybe';
      x0 = e.touches[0]!.clientX; y0 = e.touches[0]!.clientY; v = 0; last = { x: x0, t: e.timeStamp };
    };
    const move = (e: TouchEvent) => {
      if (st === 'off') return;
      const cx = e.touches[0]!.clientX, dx = cx - x0, dy = e.touches[0]!.clientY - y0;
      if (st === 'maybe') {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.5) { st = 'off'; return; }
        st = 'on';
      }
      e.preventDefault();
      const { idx, tos } = live.current, to = idx - Math.sign(dx);
      x.set(to < 0 || to >= tos.length ? dx * 0.2 : dx); // en los extremos, con resistencia
      if (e.timeStamp > last.t) v = ((cx - last.x) / (e.timeStamp - last.t)) * 1000;
      last = { x: cx, t: e.timeStamp };
    };
    const end = () => {
      if (st !== 'on') { st = 'off'; return; }
      st = 'off';
      const { idx, tos, spring: s } = live.current, dx = x.get(), dir = dx < 0 ? 1 : -1, to = idx + dir, w = el.offsetWidth;
      const go = to >= 0 && to < tos.length && (Math.abs(dx) > w * 0.3 || (Math.abs(v) > 500 && Math.sign(v) === -dir));
      if (!go) { void animate(x, 0, s('snappy', { velocity: v })); return; }
      vibrate('tick');
      enter.current = dir * w + dx; // la nueva arranca donde estaría pegada a la actual
      navigate(tos[to]!);
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end);
    };
  }, [x, navigate]);

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
        {items.slice(0, -1).map(side)}
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
      <main className="main" ref={mainRef}>
        <m.div style={{ x }}>
          <m.div key={section} initial={from ? { x: from } : { opacity: 0, y: 10 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={spring(from ? 'snappy' : 'gentle')}>
            <Outlet />
          </m.div>
        </m.div>
      </main>
    </div>
  );
}
