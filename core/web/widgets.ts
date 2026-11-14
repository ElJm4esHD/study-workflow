import { Capacitor, registerPlugin } from '@capacitor/core';

interface WidgetsPlugin {
  setServer(o: { url: string | null }): Promise<void>;
  refresh(): Promise<void>;
  takeRoute(): Promise<{ route: string | null }>;
  askNotifications(): Promise<void>;
  setDone(o: { id: string; completed: boolean }): Promise<void>;
  addListener(ev: 'route', fn: (d: { route: string }) => void): Promise<{ remove(): Promise<void> }>;
}
// Plugin local en Kotlin (android/.../widget/WidgetsPlugin); solo existe en nativo.
// No importa server.ts para no crear un import circular.
const plugin = Capacitor.isNativePlatform() ? registerPlugin<WidgetsPlugin>('Widgets') : null;

// Un fallo del widget nunca debe romper la app.
export const setWidgetServer = (url: string | null): void => void plugin?.setServer({ url }).catch(() => {});
export const refreshWidgets = (): void => void plugin?.refresh().catch(() => {});
/** Pide el permiso de notificaciones (Android 13+) la primera vez que se pone un recordatorio. */
export const askNotifications = (): void => void plugin?.askNotifications().catch(() => {});
/** Tilde hecho sin conexión en la app: el nativo actualiza su copia y cancela el recordatorio. */
export const markWidgetDone = (id: string, completed: boolean): void => void plugin?.setDone({ id, completed }).catch(() => {});
export const takeWidgetRoute = async (): Promise<string | null> => (plugin ? (await plugin.takeRoute().catch(() => ({ route: null }))).route : null);

export function onWidgetRoute(fn: (route: string) => void): () => void {
  const h = plugin?.addListener('route', (d) => fn(d.route));
  return () => void h?.then((x) => x.remove());
}
