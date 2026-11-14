import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { Link, type To } from 'react-router';
import { animate, AnimatePresence, m, useDragControls, useMotionValue, useTransform } from 'motion/react';
import { useMotion } from './motion.tsx';
import { reloadAll } from './api.ts';
import { vibrate } from './haptics.ts';
import { CheckIcon, RefreshIcon, TrashIcon } from './icons.tsx';

/** Componentes base compartidos. Las pantallas de los módulos usan estos y no variantes propias. */

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: ComponentType; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ic"><Icon /></div>
      <b>{title}</b>
      {children && <span>{children}</span>}
      {action}
    </div>
  );
}

/** Bloque de carga: el brillo lo da CSS; con "Sin animaciones" queda quieto. */
export const Skeleton = ({ w = '100%', h = 14, r }: { w?: string; h?: number; r?: number }) =>
  <div className="skel" style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />;

export function PageSkeleton() {
  const card = (n: number) => (
    <div className="card skel-card">
      <Skeleton w="40%" h={18} />
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skel-row"><Skeleton w="22px" h={22} r={6} /><div><Skeleton w="70%" /><Skeleton w="30%" h={10} /></div></div>
      ))}
    </div>
  );
  return <div role="status" aria-label="Cargando"><div className="page-head"><Skeleton w="180px" h={26} /></div><div className="dash-skel">{card(2)}{card(4)}</div></div>;
}

/** Selector segmentado; el fondo del activo se desliza con un resorte (layoutId). `name` distingue instancias. */
export function Segmented<T extends string>({ name, label, value, options, onChange }: {
  name: string; label: string; value: T; options: readonly (readonly [T, string])[]; onChange(v: T): void;
}) {
  const { spring } = useMotion();
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {v === value && <m.span className="seg-ind" layoutId={`seg-${name}`} transition={spring('snappy')} />}
          <span>{text}</span>
        </button>
      ))}
    </div>
  );
}

/** Hoja de abajo (celu): entra con resorte, se arrastra desde la manija o el contenido y se suelta con velocidad. */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose(): void; label: string; children: ReactNode }) {
  const { spring, fade } = useMotion();
  const drag = useDragControls();
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Solo al abrir/cerrar (no en cada render del padre): foco al primer control y Esc para cerrar.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', esc);
    ref.current?.querySelector<HTMLElement>('a, button:not(.sheet-grab)')?.focus({ preventScroll: true });
    return () => { document.removeEventListener('keydown', esc); prev?.focus?.({ preventScroll: true }); };
  }, [open]);
  return (
    <Floating><AnimatePresence>
      {open && (
        <>
          <m.div className="scrim" key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade(0.2)} onClick={onClose} />
          <m.section
            key="sheet" ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={label}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring('sheet')}
            drag="y" dragControls={drag} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.7 }}
            onDragEnd={(_, i) => { if (i.offset.y > 120 || i.velocity.y > 700) onClose(); }}
          >
            <div className="sheet-grab" onPointerDown={(e) => drag.start(e)} />
            <div className="sheet-body">{children}</div>
          </m.section>
        </>
      )}
    </AnimatePresence></Floating>
  );
}

/** Lo `position: fixed` (hojas, botón +) va al body: la pantalla se anima con transform y lo correría de lugar. */
export const Floating = ({ children }: { children: ReactNode }) => createPortal(children, document.body);

type TaskRowProps = {
  title: ReactNode;
  meta?: ReactNode;
  duration?: ReactNode;
  done?: boolean;
  selected?: boolean;
  /** Variables de la materia (`materiaVars`) para la barra y el checkbox. */
  colorVars?: CSSProperties;
  to: To;
  toggleLabel: string;
  onToggle(): void;
  /** Deslizar a la derecha (completar) / a la izquierda (borrar). Sin ellos la fila no se desliza. */
  onSwipeRight?(): void;
  onSwipeLeft?(): void;
  /** Para reordenar con dnd-kit: ref, atributos, listeners y estilo van al elemento `.task-row`. */
  dndRef?: Ref<HTMLDivElement>;
  dndProps?: HTMLAttributes<HTMLDivElement>;
  dndStyle?: CSSProperties;
  dragging?: boolean;
  /** Apaga la animación de layout (por ejemplo, justo después de soltar un reordenamiento de dnd-kit). */
  noLayout?: boolean;
  /** Control extra al final de la fila y contenido desplegable debajo (por ejemplo, subtareas). */
  trailing?: ReactNode;
  below?: ReactNode;
};

/** Fila de tarea única (To-do, Inicio, Calendario). El `m.li` anima entrada/salida y reacomodo (layout). */
export function TaskRow(p: TaskRowProps) {
  const { spring } = useMotion();
  const x = useMotionValue(0);
  const inner = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const [side, setSide] = useState<'done' | 'del' | null>(null);
  const [armed, setArmed] = useState(false);
  const swipe = !!(p.onSwipeRight || p.onSwipeLeft);
  const width = () => inner.current?.offsetWidth ?? 360;
  return (
    <m.li layout={p.noLayout ? false : 'position'} className="row-wrap" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }} transition={spring('gentle')}>
      <div ref={p.dndRef} {...p.dndProps} style={{ ...p.colorVars, ...p.dndStyle }} data-swipe={side ?? undefined}
        className={`task-row${p.done ? ' done' : ''}${p.selected ? ' sel' : ''}${p.dragging ? ' dragging' : ''}${armed ? ' armed' : ''}`}>
        {swipe && <div className="swipe-bg" aria-hidden="true"><span className="sb-done"><CheckIcon size={18} />Completar</span><span className="sb-del">Borrar<TrashIcon size={18} /></span></div>}
        <m.div ref={inner} className="row-inner" style={{ x }}
          drag={swipe ? 'x' : false} dragDirectionLock dragMomentum={false}
          onDragStart={() => { moved.current = true; }}
          onDrag={(_, i) => {
            const dir = i.offset.x > 0 ? 'done' : 'del';
            const allowed = dir === 'done' ? p.onSwipeRight : p.onSwipeLeft;
            if (!allowed) { x.set(0); return; }
            if (side !== dir) setSide(dir);
            const a = Math.abs(i.offset.x) > width() * 0.4;
            if (a !== armed) { setArmed(a); if (a) vibrate('tick'); }
          }}
          onDragEnd={(_, i) => {
            const dx = x.get(), v = i.velocity.x, dir = Math.sign(dx);
            const fling = Math.abs(v) > 700 && Math.sign(v) === dir && Math.abs(dx) > 30;
            const act = dir > 0 ? p.onSwipeRight : p.onSwipeLeft;
            setArmed(false);
            setTimeout(() => { moved.current = false; }, 0);
            if (act && (Math.abs(dx) > width() * 0.4 || fling)) {
              void animate(x, dir * width() * 1.05, spring('snappy', { velocity: v, bounce: 0 })).then(() => {
                act();
                // Si la fila no se fue (por ejemplo, sin conexión), vuelve a su lugar.
                setTimeout(() => { x.set(0); setSide(null); }, 700);
              });
            } else {
              void animate(x, 0, spring('snappy', { velocity: v })).then(() => setSide(null));
            }
          }}>
          <button type="button" className="chk" onClick={p.onToggle} aria-pressed={!!p.done} aria-label={p.toggleLabel}><span /></button>
          <Link to={p.to} className="body" draggable={false} onClickCapture={(e) => { if (moved.current) e.preventDefault(); }}>
            <div className="title">{p.title}</div>
            {p.meta && <div className="meta">{p.meta}</div>}
          </Link>
          <span className="dur">{p.duration}</span>
          {p.trailing}
        </m.div>
      </div>
      {p.below && <div style={p.colorVars}>{p.below}</div>}
    </m.li>
  );
}

/** Tirar para refrescar (solo táctil): el indicador baja con resistencia, se arma a los 64 px y al soltar recarga todo. */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const { spring } = useMotion();
  const y = useMotionValue(0);
  const contentY = useTransform(y, (v) => v * 0.5);
  const rotate = useTransform(y, (v) => v * 3);
  const opacity = useTransform(y, [0, 48], [0, 1]);
  const [state, setState] = useState<'idle' | 'armed' | 'loading'>('idle');
  const ref = useRef<HTMLDivElement>(null);
  const springRef = useRef(spring);
  springRef.current = spring;
  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia('(pointer: coarse)').matches) return;
    let y0: number | null = null, x0 = 0, t0 = 0, active = false, armed = false, busy = false;
    const start = (e: TouchEvent) => {
      if (busy || window.scrollY > 0 || e.touches.length > 1 || document.querySelector('.sheet')) return;
      y0 = e.touches[0]!.clientY; x0 = e.touches[0]!.clientX; t0 = performance.now(); active = false;
    };
    const move = (e: TouchEvent) => {
      if (y0 === null) return;
      const dy = e.touches[0]!.clientY - y0, dx = e.touches[0]!.clientX - x0;
      if (!active) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Horizontal (deslizar fila), hacia arriba o después de mantener apretado (reordenar): no es para nosotros.
        if (dy <= 0 || Math.abs(dx) > dy || performance.now() - t0 > 220) { y0 = null; return; }
        active = true;
      }
      e.preventDefault();
      const pull = 110 * (1 - Math.exp(-Math.max(0, dy) / 200));
      y.set(pull);
      const a = pull >= 64;
      if (a !== armed) { armed = a; setState(a ? 'armed' : 'idle'); if (a) vibrate('tick'); }
    };
    const end = async () => {
      if (y0 === null) return;
      y0 = null;
      if (!active) return;
      active = false;
      const s = springRef.current;
      if (!armed) { void animate(y, 0, s('snappy')); return; }
      armed = false; busy = true;
      vibrate('release'); setState('loading');
      void animate(y, 64, s('snappy'));
      reloadAll();
      await new Promise((r) => setTimeout(r, 700));
      setState('idle'); busy = false;
      void animate(y, 0, springRef.current('gentle'));
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end);
    };
  }, [y]);
  return (
    <div ref={ref}>
      <m.div className={`ptr ${state}`} style={{ y, opacity }} aria-hidden="true"><m.span style={{ rotate }}><RefreshIcon size={18} /></m.span></m.div>
      <m.div style={{ y: contentY }}>{children}</m.div>
    </div>
  );
}
