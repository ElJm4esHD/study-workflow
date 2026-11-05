import { useMemo } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router';
import { CoreProvider, useCore } from './CoreContext.tsx';
import { ErrorBoundary, ErrorScreen } from './ErrorBoundary.tsx';
import { Shell } from './Shell.tsx';
import { InicioPage } from './InicioPage.tsx';
import { AjustesPage } from './AjustesPage.tsx';

function Routes() {
  const { enabledModules } = useCore();
  const key = enabledModules.map((m) => m.id).join();
  // Se recrea solo cuando cambia el conjunto de módulos activos, no en cada render.
  const router = useMemo(() => {
    const routes: RouteObject[] = [{
      element: <Shell />,
      errorElement: <ErrorScreen />,
      children: [
        { path: '/', element: <InicioPage /> },
        ...enabledModules.flatMap((m) => m.routes),
        { path: '/ajustes', element: <AjustesPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    }];
    return createBrowserRouter(routes);
  }, [key]); // eslint-disable-line
  return <RouterProvider router={router} />;
}

export function App() {
  return <ErrorBoundary><CoreProvider><Routes /></CoreProvider></ErrorBoundary>;
}
