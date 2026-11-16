// Arma la web pública (sin server) para GitHub Pages y la audita. Uso: node scripts/pages.mjs [--publish].
// Sin --publish solo deja dist/pages listo. Con --publish sube dist/pages a la rama gh-pages (sin Actions ni secretos en GitHub).
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' && cmd === 'npx', ...opts });
const out = join(root, 'dist', 'pages');

if (!existsSync(join(root, '.env.google')) && !process.env.GOOGLE_WEB_CLIENT_ID) console.warn('• No hay .env.google ni GOOGLE_WEB_CLIENT_ID: el sitio se arma sin Drive (solo "este dispositivo").');
if (run('npx', ['vite', 'build', '--mode', 'pages'], { stdio: 'inherit' }).status !== 0) die('Falló el build.');
copyFileSync(join(out, 'index.html'), join(out, '404.html')); // Pages no reescribe rutas: una recarga en /study-workflow/calendario sirve la app igual
writeFileSync(join(out, '.nojekyll'), '');
if (run('node', ['scripts/audit-apk.mjs', out], { stdio: 'inherit' }).status !== 0) die('La auditoría encontró datos privados. NO se publicó nada.');

if (!process.argv.includes('--publish')) { console.log(`✔ Sitio listo en ${out} (sin publicar).`); process.exit(0); }

// Publicar: repo temporal con solo el sitio, empujado (forzado) a gh-pages del remote "github".
const url = run('git', ['remote', 'get-url', 'github']).stdout.trim() || die('No hay remote "github".');
const tmp = mkdtempSync(join(tmpdir(), 'sw-pages-'));
try {
  const g = (...a) => { const r = spawnSync('git', a, { cwd: tmp, encoding: 'utf8' }); if (r.status !== 0) die(`git ${a[0]} falló: ${r.stderr}`); return r.stdout; };
  g('init', '-q', '-b', 'gh-pages');
  const cp = spawnSync(process.platform === 'win32' ? 'robocopy' : 'cp', process.platform === 'win32' ? [out, tmp, '/E', '/NFL', '/NDL', '/NJH', '/NJS'] : ['-r', `${out}/.`, tmp], { encoding: 'utf8' });
  if (process.platform === 'win32' ? cp.status >= 8 : cp.status !== 0) die('No pude copiar el sitio.');
  g('add', '-A');
  g('-c', `user.name=${run('git', ['config', 'user.name']).stdout.trim()}`, '-c', `user.email=${run('git', ['config', 'user.email']).stdout.trim()}`, 'commit', '-q', '-m', 'Sitio de GitHub Pages');
  g('push', '-f', url, 'gh-pages');
  console.log('✔ Publicado en la rama gh-pages.');
} finally { rmSync(tmp, { recursive: true, force: true }); }
