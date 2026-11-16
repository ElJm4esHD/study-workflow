import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';

// La versión sale de package.json (única fuente; también la usan el server y el APK).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// URL del server precargada en el APK: sale solo de .env.deploy (no se commitea). Sin el archivo queda vacía.
const envFile = new URL('./.env.deploy', import.meta.url);
// SW_PUBLIC=1 (npm run apk:public): build genérico para el Release, sin leer .env.deploy.
const env = process.env.SW_PUBLIC !== '1' && existsSync(envFile) ? Object.fromEntries([...readFileSync(envFile, 'utf8').matchAll(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/gm)].map((m) => [m[1], m[2]])) : {};
// npm run apk -- --next apunta al server de prueba (HTTPS_PORT_NEXT).
const httpsPort = process.env.SW_NEXT === '1' ? env.HTTPS_PORT_NEXT : env.HTTPS_PORT;
const defaultServer = env.DEPLOY_HOST && httpsPort ? `https://${env.DEPLOY_HOST}:${httpsPort}` : '';

// `vite build --mode pages` (npm run pages): la web pública en GitHub Pages, sin server propio; el ID de cliente OAuth sale de .env.google o del entorno (es público por diseño, pero no se commitea).
const googleFile = new URL('./.env.google', import.meta.url);
const googleEnv = existsSync(googleFile) ? Object.fromEntries([...readFileSync(googleFile, 'utf8').matchAll(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/gm)].map((m) => [m[1], m[2]])) : {};
const googleId = process.env.GOOGLE_WEB_CLIENT_ID ?? googleEnv.GOOGLE_WEB_CLIENT_ID ?? '';

export default defineConfig(({ mode }) => ({
  root: 'web',
  base: mode === 'pages' ? '/study-workflow/' : '/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __DEFAULT_SERVER__: JSON.stringify(mode === 'pages' ? '' : defaultServer),
    __PAGES__: JSON.stringify(mode === 'pages'),
    __GOOGLE_CLIENT_ID__: JSON.stringify(mode === 'pages' ? googleId : ''),
  },
  build: { outDir: mode === 'pages' ? '../dist/pages' : '../dist/web', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:3000' }, fs: { allow: ['..'] } },
}));
