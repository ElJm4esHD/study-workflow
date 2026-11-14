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
import { parentOf } from './back.ts';
import { MotionRoot } from './motion.tsx';
import { onWidgetRoute, setWidgetServer, takeWidgetRoute } from './widgets.ts';

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
  // Ruta pedida desde un widget (tocar una tarea, un día o el "+").
  useEffect(() => {
    // Primero la pantalla padre: así Atrás desde la tarea vuelve a la lista y no a lo que hubiera antes.
    const go = async (r: string | null) => {
      if (!r) return;
      const up = parentOf(r.split('?')[0]!);
      if (up) await router.navigate(up);
      void router.navigate(r);
    };
    void takeWidgetRoute().then(go);
    return onWidgetRoute(go);
  }, [router]);
  // Botón Atrás de Android (lo llama MainActivity): true = lo resolvió la web; false = minimizar la app.
  useEffect(() => {
    (window as unknown as { swBack?: () => boolean }).swBack = () => {
      if (window.history.state?.idx > 0) { void router.navigate(-1); return true; }
      const up = parentOf(router.state.location.pathname);
      if (up) void router.navigate(up, { replace: true });
      return !!up;
    };
  }, [router]);
  return <RouterProvider router={router} />;
}

export function App() {
  const [connected, setConnected] = useState(!isNative() || !!getServerUrl());
  // Instalaciones ya configuradas: el nativo todavía no conoce la URL.
  useEffect(() => { setWidgetServer(getServerUrl()); }, []);
  if (!connected) return <ConnectScreen onDone={() => setConnected(true)} />;
  return <ErrorBoundary><MotionRoot><CoreProvider><Routes /></CoreProvider></MotionRoot></ErrorBoundary>;
}
