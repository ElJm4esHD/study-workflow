import { expect, test } from 'vitest';
import { nameKey } from './normalize.ts';

test('nameKey ignora mayúsculas, tildes y espacios', () =>
  expect(nameKey('  Álgebra   Lineal ')).toBe(nameKey('algebra lineal')));
test('nameKey distingue nombres distintos', () => expect(nameKey('Física I')).not.toBe(nameKey('Física II')));
