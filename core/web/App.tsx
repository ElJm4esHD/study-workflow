import { useEffect, useMemo, useState } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router';
import { CoreProvider, useCore } from './CoreContext.tsx';
import { ErrorBoundary, ErrorScreen } from './ErrorBoundary.tsx';
import { Shell } from './Shell.tsx';
import { InicioPage } from './InicioPage.tsx';
import { AjustesPage } from './AjustesPage.tsx';
import { ConnectScreen } from './ConnectScreen.tsx';
import { getServerUrl, isNative } from './server.ts';
import { onSharedText, stashShared, takeSharedText } from './shared.ts';

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
  // Texto recibido por Compartir: se guarda en memoria y se navega al primer módulo activo que lo acepta.
  useEffect(() => {
    const target = enabledModules.find((m) => m.shareTarget)?.shareTarget;
    const got = (text: string | null) => { if (text && target) { stashShared(text); void router.navigate(target); } };
    void takeSharedText().then(got);
    return onSharedText(got);
  }, [router]); // eslint-disable-line
  return <RouterProvider router={router} />;
}

export function App() {
  const [connected, setConnected] = useState(!isNative() || !!getServerUrl());
  if (!connected) return <ConnectScreen onDone={() => setConnected(true)} />;
  return <ErrorBoundary><CoreProvider><Routes /></CoreProvider></ErrorBoundary>;
}
