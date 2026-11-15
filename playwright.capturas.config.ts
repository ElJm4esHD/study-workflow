import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

/** Capturas de todas las pantallas y estados (docs/capturas/) con una base temporal: `npm run capturas`. */
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'capturas.spec.ts',
  workers: 1,
  reporter: 'list',
  timeout: 90_000,
  use: { baseURL: 'http://127.0.0.1:4174', locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' },
  webServer: {
    command: 'node core/server/main.ts',
    url: 'http://127.0.0.1:4174/api/health',
    env: { PORT: '4174', HOST: '127.0.0.1', DB_PATH: './data/capturas.sqlite', WEB_DIST: join(process.cwd(), 'dist/web') },
    reuseExistingServer: false,
  },
});
