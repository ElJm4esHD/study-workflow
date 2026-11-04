// Deploy de un comando. Uso: node scripts/deploy.mjs [--setup]. Solo Node; necesita `git` y `ssh` en el PATH.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const die = (msg) => { console.error(msg); process.exit(1); };
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', ...opts });

const envFile = join(root, '.env.deploy');
if (!existsSync(envFile)) {
  die('Falta .env.deploy. Copiá .env.deploy.example a .env.deploy y completá DEPLOY_HOST (hostname MagicDNS del server).');
}
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]),
);
const { DEPLOY_HOST: host, DEPLOY_USER: user = 'tu-usuario', PORT: port = '8080' } = env;
if (!host) die('Falta DEPLOY_HOST en .env.deploy.');
const target = `${user}@${host}`;

if (process.argv.includes('--setup')) {
  // CRLF fuera: un checkout en Windows puede convertir el script y bash lo rechaza.
  const script = readFileSync(join(root, 'scripts/server-setup.sh'), 'utf8').replace(/\r/g, '');
  const r = spawnSync('ssh', [target, `bash -s ${port}`], { input: script, stdio: ['pipe', 'inherit', 'inherit'] });
  process.exit(r.status ?? 1);
}

const git = (...a) => run('git', a).stdout.trim();
if (git('status', '--porcelain')) die('Hay cambios sin commitear. Commiteá o guardalos antes de deployar.');
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') die('Solo se deploya desde la rama main.');
const sha = git('rev-parse', 'HEAD');

const push = run('git', ['push', `ssh://${target}/~/git/study-workflow.git`, 'main'], { stdio: 'inherit' });
if (push.status !== 0) die('✖ Deploy FALLÓ: no se pudo hacer push (¿corriste npm run server-setup?).');

const remote = `git --git-dir ~/git/study-workflow.git show ${sha}:scripts/remote-deploy.sh | bash -s ${sha} ${port}`;
const r = spawnSync('ssh', [target, remote], { stdio: 'inherit' });
const code = r.status ?? 1;
console.log(code === 0 ? `✔ Deploy OK (${sha.slice(0, 7)})` : '✖ Deploy FALLÓ, la versión anterior sigue corriendo');
process.exit(code);
