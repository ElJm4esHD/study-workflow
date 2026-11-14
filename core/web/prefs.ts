import { useSyncExternalStore } from 'react';

/** Ajustes de este dispositivo (no se sincronizan con el servidor): velocidad de animaciones, vibración y letra. */
export type Speed = 'lenta' | 'normal' | 'rapida' | 'off';
export type Vibration = 'off' | 'suave' | 'media' | 'fuerte';
export type FontSize = 'chica' | 'normal' | 'grande';
export interface Prefs { speed: Speed; vibration: Vibration; font: FontSize }

export const SPEED_K: Record<Speed, number> = { lenta: 1.6, normal: 1, rapida: 0.6, off: 0 };
export const VIBRATION_K: Record<Vibration, number> = { off: 0, suave: 0.5, media: 1, fuerte: 1.8 };
export const FONT_K: Record<FontSize, number> = { chica: 0.92, normal: 1, grande: 1.12 };

const KEY = 'sw.prefs';

function load(): Prefs {
  let saved: Partial<Prefs> = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* sin storage: valores por defecto */ }
  // No se sigue "reducir movimiento" del sistema: Windows lo activa al apagar sus efectos y la app quedaba sin animaciones.
  return {
    speed: saved.speed && saved.speed in SPEED_K ? saved.speed : 'normal',
    vibration: saved.vibration && saved.vibration in VIBRATION_K ? saved.vibration : 'media',
    font: saved.font && saved.font in FONT_K ? saved.font : 'normal',
  };
}

let prefs = load();
const listeners = new Set<() => void>();

function apply() {
  const s = document.documentElement.style;
  s.setProperty('--k', String(SPEED_K[prefs.speed]));
  s.setProperty('--fs', String(FONT_K[prefs.font]));
  document.documentElement.dataset.motion = prefs.speed === 'off' ? 'off' : 'on';
}
apply();

export const getPrefs = () => prefs;

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  prefs = { ...prefs, [key]: value };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* idem */ }
  apply();
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, getPrefs);
}
