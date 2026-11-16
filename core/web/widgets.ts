import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core';
import type { Row } from './sync/db.ts';

interface WidgetsPlugin {
  setServer(o: { url: string | null }): Promise<void>;
  setTarget(o: { kind: 'server' | 'drive' | 'local' }): Promise<void>;
  refresh(): Promise<void>;
  takeRoute(): Promise<{ route: string | null }>;
  askNotifications(): Promise<void>;
  setAccent(o: { hex: string; light: string }): Promise<void>;
  setTheme(o: { mode: 'dark' | 'light' | 'system' }): Promise<void>;
  testReminder(o: { insistent: boolean }): Promise<void>;
  dbLoad(): Promise<{ rows: Row[]; meta: Record<string, string> }>;
  dbApply(o: { put: Row[]; del: [string, string][]; meta?: Record<string, string> }): Promise<void>;
  addListener(ev: 'dbChanged', fn: () => void): Promise<{ remove(): Promise<void> }>;
  addListener(ev: 'route', fn: (d: { route: string }) => void): Promise<{ remove(): Promise<void> }>;
}
// Plugin local en Kotlin (android/.../widget/WidgetsPlugin); solo existe en nativo.
// No importa server.ts para no crear un import circular.
export const plugin = Capacitor.isNativePlatform() ? registerPlugin<WidgetsPlugin>('Widgets') : null;

// Un fallo del widget nunca debe romper la app.
export const setWidgetServer = (url: string | null): void => void plugin?.setServer({ url }).catch(() => {});
/** Destino de sincronización: el sync de fondo (Kotlin) lo lee de acá. */
export const setWidgetTarget = (kind: 'server' | 'drive' | 'local'): void => void plugin?.setTarget({ kind }).catch(() => {});
export const refreshWidgets = (): void => void plugin?.refresh().catch(() => {});
/** Pide el permiso de notificaciones (Android 13+) la primera vez que se pone un recordatorio. */
export const askNotifications = (): void => void plugin?.askNotifications().catch(() => {});
/** Pasa el color de acento al widget (se guarda en el nativo). */
export const setWidgetAccent = (hex: string, light: string): void => void plugin?.setAccent({ hex, light }).catch(() => {});
/** Tema elegido: el nativo lo guarda para el widget y el splash; las barras del sistema siguen al tema que se ve. */
export function setNativeTheme(mode: 'dark' | 'light' | 'system', shown: 'dark' | 'light'): void {
  if (!plugin) return;
  void plugin.setTheme({ mode }).catch(() => {});
  void SystemBars.setStyle({ style: shown === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => {});
}
/** Muestra ahora un recordatorio de prueba (mismo canal y sonido que los reales). */
export const testReminder = (insistent: boolean): void => void plugin?.testReminder({ insistent }).catch(() => {});
export const takeWidgetRoute = async (): Promise<string | null> => (plugin ? (await plugin.takeRoute().catch(() => ({ route: null }))).route : null);

export function onWidgetRoute(fn: (route: string) => void): () => void {
  const h = plugin?.addListener('route', (d) => fn(d.route));
  return () => void h?.then((x) => x.remove());
}
