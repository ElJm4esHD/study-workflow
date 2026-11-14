import { getPrefs, VIBRATION_K } from './prefs.ts';
import { isNative } from './server.ts';

const PATTERNS = { tick: [8], success: [10, 40, 14], warn: [14, 30, 14], release: [14] } as const;

/** Vibración con la intensidad elegida; solo en el APK. Etapa 4: pasa a @capacitor/haptics. */
export function vibrate(kind: keyof typeof PATTERNS) {
  const k = VIBRATION_K[getPrefs().vibration];
  if (!k || !isNative()) return;
  try { navigator.vibrate?.(PATTERNS[kind].map((ms, i) => (i % 2 ? ms : Math.round(ms * k)))); } catch { /* sin soporte */ }
}
