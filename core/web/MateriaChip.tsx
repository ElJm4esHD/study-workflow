import type { CSSProperties } from 'react';
import type { Materia } from '../server/registry.ts';
import { strongOf } from '../shared/palette.ts';

/** Variables de color de una materia (`--m` pastel, `--ms` fuerte) para el `style` de cualquier elemento. */
export const materiaVars = (color: string) => ({ '--m': color, '--ms': strongOf(color) }) as CSSProperties;

export function MateriaChip({ materia }: { materia: Pick<Materia, 'name' | 'color' | 'sigla'> }) {
  return <span className="chip" style={materiaVars(materia.color)} title={materia.name}>{materia.sigla}</span>;
}
