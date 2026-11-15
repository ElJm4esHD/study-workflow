import type { WebModule } from '../../../core/web/registry.ts';
import { FlagIcon } from '../../../core/web/icons.tsx';
import { FinalesPage } from './FinalesPage.tsx';

export const finals: WebModule = {
  id: 'finals',
  name: 'Finales',
  icon: FlagIcon,
  nav: { path: '/finales', order: 25, more: true },
  requires: ['calendar'],
  routes: [{ path: '/finales', element: <FinalesPage /> }],
};
