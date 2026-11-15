import { buildApp } from './app.ts';

export const makeTestApp = () => buildApp({ dbPath: ':memory:' });
