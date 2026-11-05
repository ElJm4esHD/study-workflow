import { expect, test } from 'vitest';
import { makeSigla, normalizeSigla } from './sigla.ts';

test.each([
  ['Análisis Matemático II', 'AM2'],
  ['Programación Imperativa', 'PI'],
  ['Matemática Discreta', 'MD'],
  ['Física', 'FIS'],
  ['Álgebra', 'ALG'],
  ['Física 1', 'FIS1'],
  ['Introducción a la Programación', 'IP'],
  ['Sistemas de Representación y Dibujo Técnico', 'SRDT'],
  ['De la', 'DEL'],
  ['C++', 'C'],
  ['  ', 'MAT'],
])('makeSigla(%s) = %s', (n, s) => expect(makeSigla(n)).toBe(s));
test('corta a 5', () => expect(makeSigla('Química Orgánica Avanzada Teórica Práctica Seis')).toHaveLength(5));
test('normalizeSigla', () => {
  expect(normalizeSigla(' am2 ')).toBe('AM2');
  expect(normalizeSigla('ABCDEF')).toBeNull();
  expect(normalizeSigla('A-B')).toBeNull();
  expect(normalizeSigla(5)).toBeNull();
});
