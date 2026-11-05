import { expect, test } from 'vitest';
import { fmtDuration } from './duration.ts';

test('fmtDuration', () => {
  expect(fmtDuration(45)).toBe('45 min');
  expect(fmtDuration(60)).toBe('1 h');
  expect(fmtDuration(90)).toBe('1 h 30 min');
  expect(fmtDuration(125)).toBe('2 h 5 min');
});
