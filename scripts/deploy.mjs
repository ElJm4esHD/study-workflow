// Deploy de un comando. Uso: node scripts/deploy.mjs [--setup] [--next]. Solo Node; necesita `git` y `ssh` en el PATH.
//   (sin flags)  deploya main en la app real.
//   --next       deploya la rama actual en la versión de prueba (otro contenedor, puerto y datos: PORT_NEXT / HTTPS_PORT_NEXT), sin tocar la real.
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
const next = process.argv.includes('--next');
const { DEPLOY_HOST: host, DEPLOY_USER: user } = env;
const port = next ? env.PORT_NEXT : env.PORT;
const httpsPort = next ? env.HTTPS_PORT_NEXT : env.HTTPS_PORT;
const name = next ? 'study-workflow-next' : 'study-workflow';
if (!host || !user || !port || !httpsPort) die(`Faltan DEPLOY_HOST, DEPLOY_USER, ${next ? 'PORT_NEXT o HTTPS_PORT_NEXT' : 'PORT o HTTPS_PORT'} en .env.deploy (ver .env.deploy.example).`);
if (next && (port === env.PORT || httpsPort === env.HTTPS_PORT)) die('PORT_NEXT y HTTPS_PORT_NEXT tienen que ser distintos de los de la app real.');
const target = `${user}@${host}`;

if (process.argv.includes('--setup')) {
  // CRLF fuera: un checkout en Windows puede convertir el script y bash lo rechaza.
  const script = readFileSync(join(root, 'scripts/server-setup.sh'), 'utf8').replace(/\r/g, '');
  const r = spawnSync('ssh', [target, `bash -s ${port} ${httpsPort} ${name}`], { input: script, stdio: ['pipe', 'inherit', 'inherit'] });
  process.exit(r.status ?? 1);
}

const git = (...a) => run('git', a).stdout.trim();
if (git('status', '--porcelain')) die('Hay cambios sin commitear. Commiteá o guardalos antes de deployar.');
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (!next && branch !== 'main') die('Solo se deploya desde la rama main (para probar otra rama: npm run deploy -- --next).');
if (next && branch === 'main') die('--next es para la rama de la versión nueva, no para main.');
const sha = git('rev-parse', 'HEAD');

// La versión de prueba va a su propia referencia del repo del server: nunca toca `main`, que es la real.
const ref = next ? `HEAD:refs/heads/next` : 'main';
const push = run('git', ['push', ...(next ? ['--force'] : []), `ssh://${target}/~/git/study-workflow.git`, ref], { stdio: 'inherit' });
if (push.status !== 0) die('✖ Deploy FALLÓ: no se pudo hacer push (¿corriste npm run server-setup?).');

const remote = `set -o pipefail; git --git-dir ~/git/study-workflow.git show ${sha}:scripts/remote-deploy.sh | bash -s ${sha} ${port} ${name}`;
const r = spawnSync('ssh', [target, remote], { stdio: 'inherit' });
const code = r.status ?? 1;
console.log(code === 0 ? `✔ Deploy OK${next ? ' (versión de prueba)' : ''} (${sha.slice(0, 7)})` : '✖ Deploy FALLÓ (mirá el mensaje de arriba)');
process.exit(code);
