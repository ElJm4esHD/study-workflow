// Audita un APK (o una carpeta, como el sitio de GitHub Pages) antes de publicarlo: descomprime cada archivo y busca datos privados. Uso: node scripts/audit-apk.mjs <apk|carpeta>.
// Busca en UTF-8/latin1 y en UTF-16LE (resources.arsc y el manifest binario guardan texto así). Sale con 1 si encuentra algo.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const apk = process.argv[2];
if (!apk || !existsSync(apk)) { console.error('Uso: node scripts/audit-apk.mjs <archivo.apk|carpeta>'); process.exit(2); }

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const checks = []; // [etiqueta, regex] — las etiquetas no muestran el valor, así el reporte se puede compartir
const add = (label, re) => checks.push([label, re]);

const envFile = join(import.meta.dirname, '..', '.env.deploy');
if (existsSync(envFile)) {
  for (const [, k, v] of readFileSync(envFile, 'utf8').matchAll(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/gm)) {
    if (!v) continue;
    add(`.env.deploy ${k}`, /^\d+$/.test(v) ? new RegExp(`(?<![0-9])${v}(?![0-9])`) : new RegExp(esc(v), 'i'));
    if (k === 'DEPLOY_HOST') for (const part of v.split('.').filter((p) => p.length > 3 && !['ts', 'net'].includes(p))) add(`${k} (parte)`, new RegExp(esc(part), 'i'));
  }
} else console.warn('• No hay .env.deploy: solo busco rutas, usuario e IPs.');

const user = userInfo().username;
add('usuario de la compu', new RegExp(`(?<![a-z0-9])${esc(user)}(?![a-z0-9])`, 'i'));
add('carpeta de usuario', new RegExp(esc(homedir()).replace(/\\\\/g, '[\\\\/]'), 'i'));
add('ruta C:\\Users', /[a-z]:[\\/]+users[\\/]/i);
add('IP privada o de Tailscale', /(?<![0-9.])(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7]))\.\d{1,3}\.\d{1,3}(?![0-9.])/);
add('dominio ts.net real', /[a-z0-9-]+\.(?!tu-tailnet)[a-z0-9-]+\.ts\.net/i);
add('email', /[a-z0-9._%+-]+@(?:gmail\.com|itba\.edu\.ar)/i);

const hits = [];
// Largo par: utf16le con largo impar crashea Node 24.18 en Windows (0xC0000374).
const even = (b) => b.subarray(0, b.length & ~1);
// El link público al repo (github.com/<login>/study-workflow) sale en la página de privacidad: el login ya es público, y puede coincidir con DEPLOY_USER.
const REPO_URL = /github\.com\/[A-Za-z0-9-]+\/study-workflow/gi;
function scan(name, data) {
  data = Buffer.from(data.toString('latin1').replace(REPO_URL, 'github.com/REPO/study-workflow'), 'latin1');
  const texts = [data.toString('latin1'), even(data).toString('utf16le'), even(data.subarray(1)).toString('utf16le')];
  for (const [label, re] of checks) if (texts.some((t) => re.test(t))) hits.push([name, label]);
}
let count = 0;
if (statSync(apk).isDirectory()) {
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isDirectory()) walk(f); else { count++; scan(f.slice(apk.length + 1), readFileSync(f)); } } };
  walk(apk);
} else {
  // Lector de .zip mínimo (APK = zip): directorio central → cada entrada, stored o deflate.
  const buf = readFileSync(apk);
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) { console.error('✖ No parece un APK/zip válido.'); process.exit(2); }
  count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) { console.error('✖ Directorio central inválido.'); process.exit(2); }
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nLen = buf.readUInt16LE(p + 28), xLen = buf.readUInt16LE(p + 30), cLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nLen);
    p += 46 + nLen + xLen + cLen;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    if (method === 0) scan(name, raw);
    else if (method === 8) scan(name, inflateRawSync(raw));
    else hits.push([name, `método de compresión ${method} no soportado: revisalo a mano`]);
  }
}
for (const [label, re] of checks) if (re.test(apk.replaceAll('\\', '/').split('/').pop())) hits.push(['(nombre del archivo)', label]);

console.log(`Auditoría de ${apk}: ${count} archivos, ${checks.length} patrones.`);
if (hits.length) {
  for (const [f, l] of hits) console.log(`  ✖ ${l} en ${f}`);
  console.error(`✖ ${hits.length} resultado(s). NO publicar.`);
  process.exit(1);
}
console.log('✔ 0 resultados.');
