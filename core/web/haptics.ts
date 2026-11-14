import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { getPrefs } from './prefs.ts';
import { isNative } from './server.ts';

const STYLE = { suave: ImpactStyle.Light, media: ImpactStyle.Medium, fuerte: ImpactStyle.Heavy } as const;

/** Vibración nativa (efectos del sistema) con la intensidad elegida; solo en el APK. */
export function vibrate(kind: 'tick' | 'success' | 'warn' | 'release') {
  const v = getPrefs().vibration;
  if (v === 'off' || !isNative()) return;
  const p = kind === 'success' ? Haptics.notification({ type: NotificationType.Success })
    : kind === 'warn' ? Haptics.notification({ type: NotificationType.Warning })
    : Haptics.impact({ style: kind === 'tick' && v !== 'fuerte' ? ImpactStyle.Light : STYLE[v] });
  p.catch(() => { /* sin soporte */ });
}
