// Resume la salida JSON de Playwright: cada violación de axe una vez, con las pantallas donde aparece.
import { readFileSync } from 'node:fs';
const r = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const seen = new Map();
const walk = (s) => { s.specs?.forEach((sp) => sp.tests.forEach((t) => t.results.forEach((x) => (x.error?.message ?? '').split('\n').filter((l) => /^\S*\s?(minor|moderate|serious|critical) /.test(l.replace(/^.*Error: /, '').trim()) || /(minor|moderate|serious|critical) [\w-]+:/.test(l)).forEach((l) => { const k = l.replace(/^.*Error: /, '').trim().replace(/\x1b\[[0-9;]*m/g, ''); (seen.get(k) ?? seen.set(k, new Set()).get(k)).add(sp.title.replace('axe ', '')); })))); s.suites?.forEach(walk); };
r.suites.forEach(walk);
for (const [k, v] of seen) console.log(`${k.slice(0, 230)}\n   → ${[...v].join(', ')}`);
if (!seen.size) console.log('Sin violaciones.');
