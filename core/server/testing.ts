import { buildApp } from './app.ts';
import type { ServerModule } from './registry.ts';

export function makeTestApp(modules: ServerModule[] = []) {
  return buildApp({ dbPath: ':memory:', modules });
}
