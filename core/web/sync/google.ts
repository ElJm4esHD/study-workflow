import { Capacitor, registerPlugin } from '@capacitor/core';
import { AuthError } from './drive.ts';

/** Inicio de sesión con Google en la web (Google Identity Services, modelo de token). Solo pide drive.appdata; sin client secret. */

// Salen de la configuración al compilar (vite.config.ts); vacíos en los tests y en mi web, donde no hay Drive.
export const GOOGLE_CLIENT_ID: string = typeof __GOOGLE_CLIENT_ID__ === 'string' ? __GOOGLE_CLIENT_ID__ : '';
/** Build para GitHub Pages: no hay server propio, solo Drive o este dispositivo. */
export const IS_PAGES: boolean = typeof __PAGES__ === 'boolean' && __PAGES__;

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const TOKEN_KEY = 'sw.gtoken';
const TARGET_KEY = 'sw.target';

// Sesión de Google del APK (android/.../widget/GooglePlugin.kt): Google Play Services da y renueva el token; sin interfaz salvo la primera vez.
interface GooglePlugin { token(o: { interactive: boolean }): Promise<{ token: string }> }
const native = Capacitor.isNativePlatform() ? registerPlugin<GooglePlugin>('Google') : null;
export const IS_NATIVE = native !== null;
/** Drive se puede usar: en Pages hace falta un ID de cliente; en el APK no (Google reconoce la app por paquete y firma). */
export const DRIVE_AVAILABLE: boolean = IS_NATIVE || (IS_PAGES && GOOGLE_CLIENT_ID !== '');

export type TargetKind = 'drive' | 'server' | 'local';
/** Dónde se sincroniza este dispositivo. Pages: Drive o solo local (por defecto); APK: Mi servidor (por defecto) o Drive; mi web: el server de al lado. */
export const targetKind = (): TargetKind => {
  const k = localStorage.getItem(TARGET_KEY);
  if (IS_PAGES) return k === 'drive' && DRIVE_AVAILABLE ? 'drive' : 'local';
  return IS_NATIVE && k === 'drive' ? 'drive' : 'server';
};
export const setTargetKind = (k: TargetKind): void => localStorage.setItem(TARGET_KEY, k);

type Stored = { t: string; exp: number };
const stored = (): Stored | null => {
  try { const s = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null'); return s && typeof s.t === 'string' && typeof s.exp === 'number' ? s : null; } catch { return null; }
};
/** Token vigente (con un minuto de margen). Google no renueva solo en el navegador: si venció, hace falta un toque (`connectGoogle`). */
export async function driveToken(now = Date.now()): Promise<string> {
  if (native) return native.token({ interactive: false }).then((r) => r.token, () => { throw new AuthError('Google Drive: tocá "Reconectar" para seguir sincronizando.'); });
  const s = stored();
  if (s && s.exp - 60_000 > now) return s.t;
  throw new AuthError('Google Drive: tocá "Reconectar" para seguir sincronizando.');
}

type Gis = { initTokenClient(c: object): { requestAccessToken(o: object): void }; hasGrantedAllScopes(r: object, ...s: string[]): boolean; revoke(t: string, done: () => void): void };
const gis = (): Gis | undefined => (window as unknown as { google?: { accounts?: { oauth2?: Gis } } }).google?.accounts?.oauth2;

let loading: Promise<void> | null = null;
/** Carga el script de Google (solo en modo Drive). Hay que cargarlo antes del toque: el popup necesita salir directo del gesto del usuario. */
export function loadGoogle(): Promise<void> {
  return (loading ??= new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => { loading = null; fail(new Error('No se pudo cargar el inicio de sesión de Google. Revisá tu conexión.')); };
    document.head.append(s);
  }));
}

/** Abre el popup de Google y guarda el token. Llamar directo desde un clic. */
export function connectGoogle(): Promise<void> {
  if (native) return native.token({ interactive: true }).then(() => {}, (e: { message?: string }) => { throw new Error(e?.message || 'No se pudo conectar con Google.'); });
  return new Promise((ok, fail) => {
    const g = gis();
    if (!g) { fail(new Error('Todavía está cargando el inicio de sesión de Google: probá de nuevo en unos segundos.')); return; }
    g.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (r: { access_token?: string; expires_in?: number; error?: string }) => {
        if (r.error === 'access_denied') fail(new Error('No diste el permiso para guardar en Drive.'));
        else if (!r.access_token || !g.hasGrantedAllScopes(r, SCOPE)) fail(new Error('No se pudo conectar con Google. Probá de nuevo y dejá marcado el permiso de Drive.'));
        else {
          localStorage.setItem(TOKEN_KEY, JSON.stringify({ t: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 }));
          ok();
        }
      },
      error_callback: (e: { type?: string }) => fail(new Error(e.type === 'popup_closed' ? 'Cerraste la ventana de Google antes de terminar.' : 'No se pudo abrir la ventana de Google (¿el navegador la bloqueó?).')),
    }).requestAccessToken({ prompt: '' });
  });
}

/** Saca la sesión de este dispositivo y revoca el token. Los datos de Drive y los locales no se tocan. */
export function disconnectGoogle(): void {
  if (native) return; // en el celu el permiso se quita desde myaccount.google.com/permissions
  const s = stored();
  localStorage.removeItem(TOKEN_KEY);
  if (s) gis()?.revoke(s.t, () => {});
}
