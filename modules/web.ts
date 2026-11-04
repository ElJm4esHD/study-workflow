import type { WebModule } from '../core/web/registry.ts';
import { todo } from './todo/web/index.tsx';

export const webModules: WebModule[] = [todo];
