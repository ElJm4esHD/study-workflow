import { useSyncExternalStore } from 'react';
import { setWidgetAccent, setNativeTheme } from './widgets.ts';

/** Ajustes de este dispositivo (no se sincronizan con el servidor): velocidad de animaciones, vibración y letra. */
export type Speed = 'lenta' | 'normal' | 'rapida' | 'off';
export type Vibration = 'off' | 'suave' | 'media' | 'fuerte';
export type FontSize = 'chica' | 'normal' | 'grande';
export type Home = 'inicio' | 'todo' | 'calendario';
export type Accent = 'indigo' | 'celeste' | 'verde' | 'ambar' | 'rosa' | 'violeta';
export type Theme = 'oscuro' | 'claro' | 'sistema';
export interface Prefs { speed: Speed; vibration: Vibration; font: FontSize; home: Home; accent: Accent; theme: Theme }

/** Colores de acento: en oscuro el pastel (texto oscuro encima); en claro el tono fuerte (texto blanco encima). Todos AA. */
export const ACCENTS: Record<Accent, { label: string; hex: string; strong: string }> = {
  indigo: { label: 'Índigo', hex: '#b7c4ff', strong: '#3e50c4' }, celeste: { label: 'Celeste', hex: '#8fd3f0', strong: '#0a76a3' },
  verde: { label: 'Verde', hex: '#93dcbf', strong: '#17805a' }, ambar: { label: 'Ámbar', hex: '#f0d27a', strong: '#8f6200' },
  rosa: { label: 'Rosa', hex: '#f2a7ba', strong: '#c43a62' }, violeta: { label: 'Violeta', hex: '#c7b6f5', strong: '#6a4bd6' },
};
export const THEMES: [Theme, string][] = [['oscuro', 'Oscuro'], ['claro', 'Claro'], ['sistema', 'Según el sistema']];
/** Fondo de cada tema (--bg): barra del navegador y arranque. */
const BG = { dark: '#0e1117', light: '#f4f5f8' };
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
    theme: saved.theme && THEMES.some(([t]) => t === saved.theme) ? saved.theme : 'oscuro',
  };
}

let prefs = load();
const listeners = new Set<() => void>();

const systemDark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
/** Tema que se ve ahora: el elegido, o el del sistema (en el APK, el del celu) si eligió "Según el sistema". */
export const resolvedTheme = (t: Theme = prefs.theme): 'dark' | 'light' => (t === 'sistema' ? (systemDark?.matches === false ? 'light' : 'dark') : t === 'claro' ? 'light' : 'dark');

function apply() {
  const root = document.documentElement, s = root.style;
  s.setProperty('--k', String(SPEED_K[prefs.speed]));
  s.setProperty('--fs', String(FONT_K[prefs.font]));
  const theme = resolvedTheme();
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[theme]);
  const a = ACCENTS[prefs.accent], hex = theme === 'light' ? a.strong : a.hex;
  s.setProperty('--accent', hex);
  setWidgetAccent(a.hex, a.strong); // no hace nada fuera del APK; en el APK solo redibuja el widget si cambió
  setNativeTheme(prefs.theme === 'sistema' ? 'system' : theme, theme);
  s.setProperty('--accent-hover', theme === 'light' ? `color-mix(in srgb, ${hex}, black 15%)` : `color-mix(in srgb, ${hex}, white 25%)`);
  s.setProperty('--accent-soft', `color-mix(in srgb, ${hex} ${theme === 'light' ? 10 : 14}%, transparent)`);
  root.dataset.motion = prefs.speed === 'off' ? 'off' : 'on';
}
apply();
systemDark?.addEventListener('change', () => { if (prefs.theme === 'sistema') { apply(); listeners.forEach((l) => l()); } });

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
