import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';

// La versión sale de package.json (única fuente; también la usan el server y el APK).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// URL del server precargada en el APK: sale solo de .env.deploy (no se commitea). Sin el archivo queda vacía.
const envFile = new URL('./.env.deploy', import.meta.url);
const env = existsSync(envFile) ? Object.fromEntries([...readFileSync(envFile, 'utf8').matchAll(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/gm)].map((m) => [m[1], m[2]])) : {};
const defaultServer = env.DEPLOY_HOST && env.HTTPS_PORT ? `https://${env.DEPLOY_HOST}:${env.HTTPS_PORT}` : '';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version), __DEFAULT_SERVER__: JSON.stringify(defaultServer) },
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:3000' }, fs: { allow: ['..'] } },
});
