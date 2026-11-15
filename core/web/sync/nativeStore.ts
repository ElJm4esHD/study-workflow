import { plugin } from '../widgets.ts';
import type { LocalStore } from './db.ts';

/**
 * Almacenamiento del APK: archivo SQLite nativo (sw.db) que comparten la app, el widget y los recordatorios.
 * Los widgets y el sync de fondo escriben ahí aunque la app esté cerrada; `subscribe` avisa cuando eso pasa.
 */
export async function nativeStore(): Promise<LocalStore> {
  const p = plugin;
  if (!p) throw new Error('El almacenamiento nativo solo existe en el APK.');
  return {
    load: () => p.dbLoad(),
    apply: (put, del, meta) => p.dbApply({ put, del, meta }),
    subscribe(fn) {
      const h = p.addListener('dbChanged', fn);
      const vis = () => { if (document.visibilityState === 'visible') fn(); }; // por si se perdió un aviso con la app en segundo plano
      document.addEventListener('visibilitychange', vis);
      return () => { void h.then((x) => x.remove()); document.removeEventListener('visibilitychange', vis); };
    },
  };
}
