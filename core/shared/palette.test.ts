import { expect, test } from 'vitest';
import { NEUTRAL, PALETTE, strongOf } from './palette.ts';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const SURFACE = '#191e28';

test('12 pares con hex y strong únicos', () => {
  expect(PALETTE).toHaveLength(12);
  expect(new Set(PALETTE.map((c) => c.hex)).size).toBe(12);
  expect(new Set(PALETTE.map((c) => c.strong)).size).toBe(12);
});
test('pastel sobre --surface >= 4.5:1', () => {
  for (const { hex } of [...PALETTE, NEUTRAL]) expect(contrast(hex, SURFACE), hex).toBeGreaterThanOrEqual(4.5);
});
test('blanco sobre strong >= 4.5:1', () => {
  for (const { strong } of [...PALETTE, NEUTRAL]) expect(contrast('#ffffff', strong), strong).toBeGreaterThanOrEqual(4.5);
});
test('strongOf: par conocido y fallback NEUTRAL', () => {
  expect(strongOf(PALETTE[3]!.hex)).toBe(PALETTE[3]!.strong);
  expect(strongOf('#123456')).toBe(NEUTRAL.strong);
});
