import { useSyncExternalStore } from 'react';

/** Ajustes de este dispositivo (no se sincronizan con el servidor): velocidad de animaciones, vibración y letra. */
export type Speed = 'lenta' | 'normal' | 'rapida' | 'off';
export type Vibration = 'off' | 'suave' | 'media' | 'fuerte';
export type FontSize = 'chica' | 'normal' | 'grande';
export type Home = 'inicio' | 'todo' | 'calendario';
export type Accent = 'indigo' | 'celeste' | 'verde' | 'ambar' | 'rosa' | 'violeta';
export interface Prefs { speed: Speed; vibration: Vibration; font: FontSize; home: Home; accent: Accent }

/** Colores de acento a elegir: pasteles de la paleta, todos legibles sobre el fondo y con texto oscuro encima. */
export const ACCENTS: Record<Accent, { label: string; hex: string }> = {
  indigo: { label: 'Índigo', hex: '#b7c4ff' }, celeste: { label: 'Celeste', hex: '#8fd3f0' }, verde: { label: 'Verde', hex: '#93dcbf' },
  ambar: { label: 'Ámbar', hex: '#f0d27a' }, rosa: { label: 'Rosa', hex: '#f2a7ba' }, violeta: { label: 'Violeta', hex: '#c7b6f5' },
};
export const HOMES: Record<Home, string> = { inicio: 'Inicio', todo: 'To-do', calendario: 'Calendario' };

export const SPEED_K: Record<Speed, number> = { lenta: 1.6, normal: 1, rapida: 0.6, off: 0 };
export const VIBRATION_K: Record<Vibration, number> = { off: 0, suave: 0.5, media: 1, fuerte: 1.8 };
export const FONT_K: Record<FontSize, number> = { chica: 0.92, normal: 1, grande: 1.12 };

const KEY = 'sw.prefs';

function load(): Prefs {
  let saved: Partial<Prefs> = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* sin storage: valores por defecto */ }
  // Sin elección guardada, "Reducir movimiento" del sistema arranca en "Sin animaciones"; se puede cambiar en Ajustes.
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    speed: saved.speed && saved.speed in SPEED_K ? saved.speed : reduced ? 'off' : 'normal',
    vibration: saved.vibration && saved.vibration in VIBRATION_K ? saved.vibration : 'media',
    font: saved.font && saved.font in FONT_K ? saved.font : 'normal',
    home: saved.home && saved.home in HOMES ? saved.home : 'inicio',
    accent: saved.accent && saved.accent in ACCENTS ? saved.accent : 'indigo',
  };
}

let prefs = load();
const listeners = new Set<() => void>();

function apply() {
  const s = document.documentElement.style;
  s.setProperty('--k', String(SPEED_K[prefs.speed]));
  s.setProperty('--fs', String(FONT_K[prefs.font]));
  const hex = ACCENTS[prefs.accent].hex;
  s.setProperty('--accent', hex);
  s.setProperty('--accent-hover', `color-mix(in srgb, ${hex}, white 25%)`);
  s.setProperty('--accent-soft', `color-mix(in srgb, ${hex} 14%, transparent)`);
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
