import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// La versión sale de package.json (única fuente; también la usan el server y el APK).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  root: 'web',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:3000' }, fs: { allow: ['..'] } },
});
