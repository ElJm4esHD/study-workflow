import type { Materia } from '../server/registry.ts';

export function MateriaChip({ materia }: { materia: Pick<Materia, 'name' | 'color'> }) {
  return (
    <span className="chip">
      <span className="dot" style={{ background: materia.color }} aria-hidden="true" />
      {materia.name}
    </span>
  );
}
