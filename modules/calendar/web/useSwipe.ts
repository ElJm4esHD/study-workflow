import { useEffect, useRef, type RefObject } from 'react';

/** Dispara onLeft/onRight si el gesto horizontal supera 50 px y domina al vertical (para no pisar el scroll). */
export function useSwipe(ref: RefObject<HTMLElement | null>, h: { onLeft(): void; onRight(): void }) {
  const handlers = useRef(h);
  useEffect(() => { handlers.current = h; });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let x0 = 0, y0 = 0;
    const start = (e: TouchEvent) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
    const end = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? handlers.current.onLeft : handlers.current.onRight)();
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchend', end); };
  }, [ref]);
}
