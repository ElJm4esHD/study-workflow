import { Capacitor } from '@capacitor/core';
import { setWidgetServer } from './widgets.ts';

// Sale de .env.deploy al compilar (vite.config.ts); vacío si no hay .env.deploy o en los tests.
export const DEFAULT_SERVER: string = typeof __DEFAULT_SERVER__ === 'string' ? __DEFAULT_SERVER__ : '';
const KEY = 'sw.server';

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const getServerUrl = (): string | null => localStorage.getItem(KEY);
export const setServerUrl = (url: string): void => {
  localStorage.setItem(KEY, url);
  setWidgetServer(url);
};
// En la web el front y la API comparten origen; en nativo se usa la URL configurada.
export const apiBase = (): string => (isNative() ? (getServerUrl() ?? DEFAULT_SERVER).replace(/\/+$/, '') : '');

/** Saca la barra final; null si no empieza con https://. */
export function normalizeServerUrl(raw: string): string | null {
  const u = raw.trim().replace(/\/+$/, '');
  return /^https:\/\/[^/\s]+/.test(u) ? u : null;
}

export async function testServer(url: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(8000) });
    return r.ok && ((await r.json()) as { ok?: boolean }).ok === true;
  } catch {
    return false;
  }
}
