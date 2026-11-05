import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ar.federico.studyworkflow',
  appName: 'Study Workflow',
  webDir: 'dist/web',
  server: { androidScheme: 'https' },
  plugins: {
    SystemBars: { insetsHandling: 'css', style: 'DARK' },
  },
};

export default config;
