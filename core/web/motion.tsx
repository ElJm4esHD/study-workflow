import type { ReactNode } from 'react';
import { domMax, LazyMotion, MotionConfig } from 'motion/react';
import { SPEED_K, usePrefs } from './prefs.ts';

/** Resortes (visualDuration en segundos, bounce). Se multiplican por la velocidad elegida; con "Sin animaciones" duran 0. */
const SPRINGS = { snappy: [0.22, 0.15], gentle: [0.32, 0], sheet: [0.38, 0.12], pop: [0.3, 0.5] } as const;
export type SpringName = keyof typeof SPRINGS;

export function useMotion() {
  const k = SPEED_K[usePrefs().speed];
  return {
    on: k > 0,
    spring: (name: SpringName, extra: object = {}) => k
      ? { type: 'spring' as const, visualDuration: SPRINGS[name][0] * k, bounce: SPRINGS[name][1], ...extra }
      : { duration: 0 },
    fade: (s = 0.2) => ({ duration: s * k, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] }),
  };
}

/** Motion con solo lo necesario (`m.*`, drag y layout). "Sin animaciones" apaga también las de layout y gestos. */
export function MotionRoot({ children }: { children: ReactNode }) {
  const { speed } = usePrefs();
  return (
    <MotionConfig reducedMotion={speed === 'off' ? 'always' : 'never'}>
      <LazyMotion features={domMax} strict>{children}</LazyMotion>
    </MotionConfig>
  );
}
