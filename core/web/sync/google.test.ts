import { afterEach, expect, test, vi } from 'vitest';
import { AuthError } from './drive.ts';
import { driveToken } from './google.ts';

const store = (v: string | null) => vi.stubGlobal('localStorage', { getItem: () => v });
afterEach(() => vi.unstubAllGlobals());

test('driveToken: da el token vigente y pide reconectar si falta, venció o está roto', async () => {
  const now = 1_000_000;
  store(JSON.stringify({ t: 'abc', exp: now + 3_600_000 }));
  expect(await driveToken(now)).toBe('abc');
  store(JSON.stringify({ t: 'abc', exp: now + 30_000 })); // queda menos de un minuto: se considera vencido
  await expect(driveToken(now)).rejects.toBeInstanceOf(AuthError);
  store(null);
  await expect(driveToken(now)).rejects.toBeInstanceOf(AuthError);
  store('no es json');
  await expect(driveToken(now)).rejects.toBeInstanceOf(AuthError);
});
