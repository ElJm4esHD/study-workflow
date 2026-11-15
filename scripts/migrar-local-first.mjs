// Migración 1.x → 2.0 (local-first). Uso:
//   node scripts/migrar-local-first.mjs <backup-v1.json> [--out registros.json] [--cargar https://server:puerto]
//   node scripts/migrar-local-first.mjs --a-v1 <backup-v2.json|registros.json> [--out backup-v1.json]   (vuelta atrás)
// Convierte, muestra el informe antes/después (sale con error si algo no coincide) y, con --cargar, sube los registros a un server 2.0.
// Los archivos con tus datos van FUERA del repo (por defecto quedan al lado del archivo de entrada).
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { aV1, aV2, esBackupV1, informe } from '../core/shared/migracion.ts';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] ?? ''; };
const die = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };
const leer = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch (e) { return die(`No pude leer ${f}: ${e.message}`); } };

if (args.includes('--a-v1')) {
  const f = flag('--a-v1') || die('Falta el archivo. Uso: --a-v1 <backup-v2.json|registros.json>');
  const j = leer(f);
  const recs = Array.isArray(j) ? j : j?.format === 'study-workflow-backup' && j.version === 2 ? j.records : die('Ese archivo no es un backup v2 ni una lista de registros.');
  const out = flag('--out') || join(dirname(f), `backup-v1-desde-${basename(f)}`);
  const b = aV1(recs);
  writeFileSync(out, JSON.stringify(b));
  console.log(`✔ Backup v1 escrito en ${out}`);
  console.log(`  ${Object.entries(b.tables).map(([t, r]) => `${t}: ${r.length}`).join(' · ')}`);
  console.log('  Restauralo en la 1.1.x con: curl -X POST -H "Content-Type: application/json" --data @<archivo> https://<server>/api/backup');
  process.exit(0);
}

const input = args.find((a) => !a.startsWith('--') && a !== flag('--out') && a !== flag('--cargar'));
if (!input) die('Falta el backup v1. Uso: node scripts/migrar-local-first.mjs <backup-v1.json> [--out registros.json] [--cargar https://server:puerto]');
const b = leer(input);
if (!esBackupV1(b)) die('Ese archivo no es un backup v1 de Study Workflow (¿es el de la 2.0? Para volver a v1 usá --a-v1).');

const recs = aV2(b);
const inf = informe(b, recs);
const w = Math.max(...inf.lineas.map((l) => l.nombre.length));
console.log(`Backup del ${b.exportedAt}\n`);
console.log(`${'cosa'.padEnd(w)}  antes  después`);
for (const l of inf.lineas) console.log(`${l.nombre.padEnd(w)}  ${String(l.antes).padStart(5)}  ${String(l.despues).padStart(7)}  ${l.ok ? '✓' : '✖ NO COINCIDE'}`);
console.log(`\nIda y vuelta (v1 → v2 → v1, fila por fila): ${inf.idaYVuelta.length ? '✖' : '✓ idéntico'}`);
for (const p of inf.idaYVuelta) console.log(`  ${p}`);
if (!inf.ok) die('El informe no coincide: no se escribió ni se cargó nada.');

const out = flag('--out') || join(dirname(input), `registros-v2-${basename(input)}`);
writeFileSync(out, JSON.stringify(recs));
console.log(`\n✔ ${recs.length} registros escritos en ${out}`);

const url = flag('--cargar');
if (url) {
  const base = url.replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) die('--cargar necesita una dirección completa (https://...).');
  const h = await fetch(`${base}/api/health`).then((r) => r.json()).catch(() => die(`No pude conectar con ${base}.`));
  if (!h.version?.startsWith('2.')) die(`Ese server es ${h.version ?? 'desconocido'}: solo se carga en un server 2.x (¡no en el de producción 1.x!).`);
  for (let i = 0; i < recs.length; i += 500) {
    const r = await fetch(`${base}/api/sync/push`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ records: recs.slice(i, i + 500) }) });
    if (!r.ok) die(`El server rechazó el lote ${i / 500 + 1}: ${r.status} ${await r.text()}`);
  }
  // Verificación: lo que baja del server tiene que ser lo que se subió.
  let bajados = 0;
  for (let cursor = null; ;) {
    const p = await (await fetch(`${base}/api/sync/pull?limit=1000${cursor ? `&since=${encodeURIComponent(cursor)}` : ''}`)).json();
    bajados += p.records.length;
    if (!p.more) break;
    cursor = p.cursor;
  }
  console.log(`✔ Cargados en ${base}: subí ${recs.length}, el server tiene ${bajados}${bajados >= recs.length ? ' ✓' : ' ✖'}`);
  if (bajados < recs.length) process.exit(1);
}
