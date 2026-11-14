import type { WebModule } from '../../../core/web/registry.ts';
import { ImportIcon } from '../../../core/web/icons.tsx';
import { ImportPage } from './ImportPage.tsx';
import { PlansPage } from './PlansPage.tsx';

export const importar: WebModule = {
  id: 'import',
  name: 'Importar',
  icon: ImportIcon,
  nav: { path: '/importar', order: 30, more: true },
  shareTarget: '/importar',
  requires: ['todo', 'calendar'],
  routes: [
    { path: '/importar', element: <ImportPage /> },
    { path: '/importar/planes', element: <PlansPage /> },
  ],
};
