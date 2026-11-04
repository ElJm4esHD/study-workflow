import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { nameKey } from '../shared/normalize.ts';
import { PALETTE } from '../shared/palette.ts';
import { httpError } from './errors.ts';
import type { Materia, MateriasService } from './registry.ts';

type Row = { id: string; name: string; color: string; archived: number; created_at: string; updated_at: string };
const toMateria = (r: Row): Materia => ({
  id: r.id, name: r.name, color: r.color, archived: r.archived === 1, createdAt: r.created_at, updatedAt: r.updated_at,
});

function checkName(name: string): string {
  const n = name.trim();
  if (!n || n.length > 60) throw httpError(400, 'validacion', 'Datos inválidos: el nombre debe tener entre 1 y 60 caracteres.');
  return n;
}
function checkColor(color: string) {
  if (!PALETTE.some((p) => p.hex === color)) throw httpError(400, 'color_invalido', 'El color no está en la paleta.');
}
const dup = () => httpError(409, 'materia_duplicada', 'Ya existe una materia con ese nombre.');

export function makeMaterias(db: DatabaseSync): MateriasService {
  const svc: MateriasService = {
    list: () => (db.prepare('SELECT * FROM materias ORDER BY name_key').all() as Row[]).map(toMateria),
    get(id) {
      const r = db.prepare('SELECT * FROM materias WHERE id = ?').get(id) as Row | undefined;
      return r && toMateria(r);
    },
    findByNameKey(key) {
      const r = db.prepare('SELECT * FROM materias WHERE name_key = ?').get(key) as Row | undefined;
      return r && toMateria(r);
    },
    create({ id, name, color }) {
      if (id) { const ex = svc.get(id); if (ex) return ex; }
      const n = checkName(name);
      checkColor(color);
      if (svc.findByNameKey(nameKey(n))) throw dup();
      const now = new Date().toISOString();
      const newId = id ?? randomUUID();
      db.prepare('INSERT INTO materias (id, name, name_key, color, archived, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
        .run(newId, n, nameKey(n), color, now, now);
      return svc.get(newId)!;
    },
    update(id, patch) {
      const cur = svc.get(id);
      if (!cur) throw httpError(404, 'no_encontrado', 'La materia no existe.');
      const name = patch.name === undefined ? cur.name : checkName(patch.name);
      const color = patch.color ?? cur.color;
      if (patch.color !== undefined) checkColor(color);
      const other = svc.findByNameKey(nameKey(name));
      if (other && other.id !== id) throw dup();
      db.prepare('UPDATE materias SET name = ?, name_key = ?, color = ?, archived = ?, updated_at = ? WHERE id = ?')
        .run(name, nameKey(name), color, (patch.archived ?? cur.archived) ? 1 : 0, new Date().toISOString(), id);
      return svc.get(id)!;
    },
  };
  return svc;
}
