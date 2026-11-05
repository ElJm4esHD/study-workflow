import type { WebModule } from '../core/web/registry.ts';
import { todo } from './todo/web/index.tsx';
import { calendar } from './calendar/web/index.tsx';
import { importar } from './import/web/index.tsx';

export const webModules: WebModule[] = [todo, calendar, importar];
