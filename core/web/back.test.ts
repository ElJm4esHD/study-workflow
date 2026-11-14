import { expect, test } from 'vitest';
import { parentOf } from './back.ts';

test('parentOf', () => {
  expect(parentOf('/todo/abc')).toBe('/todo');
  expect(parentOf('/calendario/evento/abc')).toBe('/calendario');
  expect(parentOf('/todo')).toBeNull();
  expect(parentOf('/')).toBeNull();
});
