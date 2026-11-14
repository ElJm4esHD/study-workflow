import { useEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { AnimatePresence, m, useDragControls } from 'motion/react';
import { useMotion } from './motion.tsx';

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
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    ref.current?.querySelector<HTMLElement>('a, button:not(.sheet-grab)')?.focus({ preventScroll: true });
    return () => { document.removeEventListener('keydown', esc); prev?.focus?.({ preventScroll: true }); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
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
    </AnimatePresence>
  );
}
