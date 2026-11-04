import { expect, test } from 'vitest';
import { PALETTE } from './palette.ts';

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

test('12 colores únicos', () => {
  expect(PALETTE).toHaveLength(12);
  expect(new Set(PALETTE.map((c) => c.hex)).size).toBe(12);
});
test('contraste >= 3:1 contra blanco y #121212', () => {
  for (const { hex } of PALETTE) {
    expect(contrast(hex, '#ffffff'), hex).toBeGreaterThanOrEqual(3);
    expect(contrast(hex, '#121212'), hex).toBeGreaterThanOrEqual(3);
  }
});
