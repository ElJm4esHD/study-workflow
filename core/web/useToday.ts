import { useSyncExternalStore } from 'react';
import { todayAR } from '../shared/dates.ts';

/** "Hoy" vivo: cambia solo al pasar la medianoche (o al volver a la app) sin recargar. */
let today = todayAR();
const listeners = new Set<() => void>();
const check = () => { const t = todayAR(); if (t !== today) { today = t; listeners.forEach((l) => l()); } };
let timer: number | undefined;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    timer = window.setInterval(check, 15_000);
    document.addEventListener('visibilitychange', check);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size) { clearInterval(timer); document.removeEventListener('visibilitychange', check); }
  };
}

export const useToday = (): string => useSyncExternalStore(subscribe, () => (check(), today));
