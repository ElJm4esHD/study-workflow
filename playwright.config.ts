import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

/** Auditoría de accesibilidad (axe) sobre la app compilada, con una base temporal y datos de ejemplo. */
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'node core/server/main.ts',
    url: 'http://127.0.0.1:4173/api/materias',
    env: { PORT: '4173', HOST: '127.0.0.1', DB_PATH: './data/e2e.sqlite', WEB_DIST: join(process.cwd(), 'dist/web') },
    reuseExistingServer: false,
  },
});
