import type { WebModule } from '../../../core/web/registry.ts';
import { ChecklistIcon } from '../../../core/web/icons.tsx';
import { TodoPage } from './TodoPage.tsx';
import { TodoEditPage } from './TodoEditPage.tsx';

export const todo: WebModule = {
  id: 'todo',
  name: 'To-do',
  icon: ChecklistIcon,
  nav: { path: '/todo', order: 10 },
  routes: [
    { path: '/todo', element: <TodoPage /> },
    { path: '/todo/nueva', element: <TodoEditPage /> },
    { path: '/todo/:id', element: <TodoEditPage /> },
  ],
};
