import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ar.federico.studyworkflow',
  appName: 'Study Workflow',
  webDir: 'dist/web',
  server: { androidScheme: 'https' },
  // Solo el APK de prueba (npm run apk -- --next): permite mirar el WebView desde la compu (chrome://inspect o adb + CDP).
  android: { webContentsDebuggingEnabled: process.env.SW_NEXT === '1' },
  plugins: {
    SystemBars: { insetsHandling: 'css', style: 'DARK' },
  },
};

export default config;
