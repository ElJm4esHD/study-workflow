// Genera los íconos de la web (favicon, PWA, iOS) a partir de un solo dibujo. Uso: node scripts/icons.mjs
// El mismo dibujo está en android/.../ic_launcher_foreground.xml: si lo cambiás, cambialo en los dos.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BG = '#0e1117', ACCENT = '#b7c4ff';
const mark = `<rect x="26" y="26" width="56" height="56" rx="15" fill="${ACCENT}"/><path d="M41 55l10 10 18-22" fill="none" stroke="${BG}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
const svg = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${bg}${mark}</svg>`;
const rounded = svg(`<rect width="108" height="108" rx="24" fill="${BG}"/>`);
const full = svg(`<rect width="108" height="108" fill="${BG}"/>`);

mkdirSync('web/public', { recursive: true });
writeFileSync('web/public/favicon.svg', rounded);

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(name, size, markup) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: `web/public/${name}`, omitBackground: true });
}
await png('icon-192.png', 192, rounded);
await png('icon-512.png', 512, rounded);
await png('icon-maskable-512.png', 512, full); // el sistema le pone su máscara: el dibujo queda dentro de la zona segura
await png('apple-touch-icon.png', 180, full);
await browser.close();
console.log('Íconos listos en web/public/');
