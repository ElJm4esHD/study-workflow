// Publica la versión de package.json en GitHub Releases: APK público + auditoría + zips de las skills. Uso: npm run release.
// Frena ante cualquier problema; no publica nada si la auditoría encuentra algo. Checklist completo en docs/release.md.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';
import { NOVEDADES } from '../core/web/novedades.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', ...opts });
const git = (...a) => run('git', a).stdout.trim();
const ghCandidates = ['gh', 'C:\\Program Files\\GitHub CLI\\gh.exe'];
const gh = ghCandidates.find((c) => run(c, ['--version']).status === 0) ?? die('No encontré gh (GitHub CLI). Instalalo y corré gh auth login.');

const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const tag = `v${version}`;
const nov = NOVEDADES.find((n) => n.version === version) ?? die(`Falta la entrada ${version} en core/web/novedades.ts.`);

// 1. El código publicado tiene que ser exactamente el de GitHub.
if (git('status', '--porcelain')) die('Hay cambios sin commitear.');
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') die('No estás en main.');
if (run('git', ['fetch', '-q', 'github']).status !== 0) die('No pude hacer fetch del remote "github".');
if (git('rev-parse', 'HEAD') !== git('rev-parse', 'github/main')) die('main no está pusheado a GitHub (git push github main).');
if (run(gh, ['release', 'view', tag]).status === 0) die(`El release ${tag} ya existe. Subí la versión en package.json y novedades.ts.`);

// 2. APK genérico (sin .env.deploy) y auditoría.
if (spawnSync('node', ['scripts/apk.mjs', '--public'], { cwd: root, stdio: 'inherit' }).status !== 0) die('Falló el build del APK.');
const apk = join(root, 'dist', `study-workflow-${version}.apk`);
if (spawnSync('node', ['scripts/audit-apk.mjs', apk], { cwd: root, stdio: 'inherit' }).status !== 0) die('La auditoría encontró datos privados. NO se publicó nada.');

// 3. Un zip por skill, con la carpeta adentro (como lo pide claude.ai). Zip mínimo: deflate + crc32 de node:zlib.
function zip(out, files) {
  const local = [], central = [];
  let offset = 0;
  for (const [name, data] of files) {
    const n = Buffer.from(name), body = deflateRawSync(data), crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    local.push(h, n, body); central.push(c, n);
    offset += 30 + n.length + body.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  writeFileSync(out, Buffer.concat([...local, cd, end]));
}
mkdirSync(join(root, 'dist'), { recursive: true });
const skillZips = readdirSync(join(root, 'skills')).filter((d) => existsSync(join(root, 'skills', d, 'SKILL.md'))).map((d) => {
  const out = join(root, 'dist', `skill-${d}.zip`);
  zip(out, readdirSync(join(root, 'skills', d)).map((f) => [`${d}/${f}`, readFileSync(join(root, 'skills', d, f))]));
  return out;
});

// 4. Release con el APK y las skills.
const notes = `## ${nov.titulo}\n\n${nov.items.map((i) => `- ${i}`).join('\n')}\n\n## Instalar\n\n`
  + `Bajá **study-workflow-${version}.apk** desde el celu y abrilo. Necesitás tu propio servidor (Docker + Tailscale): la primera vez la app te pide su dirección. `
  + `Paso a paso, incluido el aviso de Play Protect, en el [README](https://github.com/ElJm4esHD/study-workflow#instalar-en-el-celu).\n\n`
  + `Las skills de Claude (\`skill-*.zip\`) se suben en claude.ai › Configuración › Capacidades › Skills.\n`;
const r = spawnSync(gh, ['release', 'create', tag, apk, ...skillZips, '--target', 'main', '--title', `Study Workflow ${version}`, '--notes', notes], { cwd: root, stdio: 'inherit' });
if (r.status !== 0) die('gh release create falló.');
console.log(`\n✔ Release ${tag} publicado con el APK y ${skillZips.length} skills.`);
