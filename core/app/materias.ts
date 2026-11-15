import { nameKey } from '../shared/normalize.ts';
import { PALETTE, strongOf } from '../shared/palette.ts';
import { makeSigla, normalizeSigla } from '../shared/sigla.ts';
import { httpError } from '../shared/errors.ts';
import type { Collection, Materia, MateriasService } from './registry.ts';

// `colorStrong` se guarda también en el documento solo para que el widget (Kotlin) no tenga que repetir la paleta; al leer se recalcula.
type Doc = Materia;
const toMateria = (d: Doc): Materia => ({ ...d, colorStrong: strongOf(d.color) });

function checkName(name: string): string {
  const n = name.trim();
  if (!n || n.length > 60) throw httpError(400, 'validacion', 'Datos inválidos: el nombre debe tener entre 1 y 60 caracteres.');
  return n;
}
function checkColor(color: string) {
  if (!PALETTE.some((p) => p.hex === color)) throw httpError(400, 'color_invalido', 'El color no está en la paleta.');
}
const checkSigla = (s: string) => normalizeSigla(s)
  ?? (() => { throw httpError(400, 'sigla_invalida', 'La sigla tiene que tener de 1 a 5 letras o números.'); })();
const dup = () => httpError(409, 'materia_duplicada', 'Ya existe una materia con ese nombre.');

export function makeMaterias(col: Collection<Doc>): MateriasService {
  const svc: MateriasService = {
    list: () => col.all().sort((a, b) => nameKey(a.name).localeCompare(nameKey(b.name))).map(toMateria),
    get(id) {
      const d = col.get(id);
      return d && toMateria(d);
    },
    findByNameKey(key) {
      const d = col.all().find((x) => nameKey(x.name) === key);
      return d && toMateria(d);
    },
    create({ id, name, color, sigla }) {
      if (id) { const ex = svc.get(id); if (ex) return ex; }
      const n = checkName(name);
      checkColor(color);
      const sg = sigla == null || (typeof sigla === 'string' && !sigla.trim()) ? makeSigla(n) : checkSigla(sigla);
      if (svc.findByNameKey(nameKey(n))) throw dup();
      const now = new Date().toISOString();
      const doc: Doc = { id: id ?? crypto.randomUUID(), name: n, color, colorStrong: strongOf(color), sigla: sg, archived: false, createdAt: now, updatedAt: now };
      col.put(doc);
      return toMateria(doc);
    },
    update(id, patch) {
      const cur = col.get(id);
      if (!cur) throw httpError(404, 'no_encontrado', 'La materia no existe.');
      const name = patch.name === undefined ? cur.name : checkName(patch.name);
      const color = patch.color ?? cur.color;
      if (patch.color !== undefined) checkColor(color);
      const sigla = patch.sigla === undefined ? cur.sigla : checkSigla(patch.sigla);
      const other = svc.findByNameKey(nameKey(name));
      if (other && other.id !== id) throw dup();
      const doc: Doc = { ...cur, name, color, colorStrong: strongOf(color), sigla, archived: patch.archived ?? cur.archived, updatedAt: new Date().toISOString() };
      col.put(doc);
      return toMateria(doc);
    },
  };
  return svc;
}
