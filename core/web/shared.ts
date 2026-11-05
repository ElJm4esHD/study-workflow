import { registerPlugin } from '@capacitor/core';
import { isNative } from './server.ts';

interface SharedTextPlugin {
  take(): Promise<{ text: string | null }>;
  addListener(ev: 'received', fn: (d: { text: string }) => void): Promise<{ remove(): Promise<void> }>;
}
// Plugin local en Kotlin/Java (android/.../SharedTextPlugin); solo existe en nativo.
const plugin = isNative() ? registerPlugin<SharedTextPlugin>('SharedText') : null;

export const takeSharedText = async (): Promise<string | null> => (plugin ? (await plugin.take()).text : null);

export function onSharedText(fn: (text: string) => void): () => void {
  const h = plugin?.addListener('received', (d) => fn(d.text));
  return () => void h?.then((x) => x.remove());
}

// Texto pendiente para la página de destino (nunca va en la URL).
let pending: string | null = null;
export const stashShared = (t: string): void => { pending = t; };
export const popShared = (): string | null => { const t = pending; pending = null; return t; };
