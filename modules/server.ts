import type { ServerModule } from '../core/server/registry.ts';
import { todo } from './todo/server/index.ts';
import { calendar } from './calendar/server/index.ts';

export const modules: ServerModule[] = [todo, calendar];
