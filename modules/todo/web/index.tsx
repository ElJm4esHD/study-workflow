import type { WebModule } from '../../../core/web/registry.ts';
import { ChecklistIcon } from '../../../core/web/icons.tsx';
import { TodoLayout } from './TodoPage.tsx';
import { TodoEditPage } from './TodoEditPage.tsx';
import { HoyCard } from './HoyCard.tsx';

export const todo: WebModule = {
  id: 'todo',
  name: 'To-do',
  icon: ChecklistIcon,
  nav: { path: '/todo', order: 10 },
  routes: [
    { path: '/todo', element: <TodoLayout />, children: [{ path: 'nueva', element: <TodoEditPage /> }, { path: ':id', element: <TodoEditPage /> }] },
  ],
  dashboard: [{ id: 'hoy', order: 20, column: 'right', Card: HoyCard }],
};
