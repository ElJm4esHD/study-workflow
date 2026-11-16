import { useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router';
import { CoreProvider, useCore } from './CoreContext.tsx';
import { ErrorBoundary, ErrorScreen } from './ErrorBoundary.tsx';
import { Shell } from './Shell.tsx';
import { InicioPage } from './InicioPage.tsx';
import { AjustesPage } from './AjustesPage.tsx';
import { NovedadesPage } from './NovedadesPage.tsx';
import { getPrefs } from './prefs.ts';
import { initLocal, local } from './local.ts';
import { reloadAll } from './api.ts';
import { firstSync, startSync } from './sync/auto.ts';
import { DEFAULT_SERVER, getServerUrl } from './server.ts';
import { onSharedText, stashShared, takeSharedText } from './shared.ts';
import { parentOf } from './back.ts';
import { MotionRoot } from './motion.tsx';
import { PageSkeleton } from './ui.tsx';
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
        { path: '/ajustes/novedades', element: <NovedadesPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    }];
    return createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' }); // en GitHub Pages la app vive en /study-workflow/
  }, [key]); // eslint-disable-line
  // Pantalla de inicio elegida en Ajustes: solo al abrir la app (una vez), y un widget o un link que pidan otra ruta ganan.
  const homed = useRef(false);
  useEffect(() => {
    if (homed.current) return;
    homed.current = true;
    const h = getPrefs().home;
    if (h !== 'inicio' && router.state.location.pathname === '/' && enabledModules.some((m) => m.nav?.path === `/${h}`)) void router.navigate(`/${h}`, { replace: true });
  }, [router]); // eslint-disable-line
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

// Abre la base local, arranca la sincronización y (solo la primera vez en un dispositivo) espera a bajar lo del servidor.
let boot: Promise<void> | null = null;
const start = () => (boot ??= (async () => {
  await initLocal();
  startSync(local().db, reloadAll);
  await firstSync(local().db);
})());

export function App() {
  const [state, setState] = useState<'loading' | 'ready' | Error>('loading');
  // Instalaciones ya configuradas: el nativo todavía no conoce la URL.
  useEffect(() => { setWidgetServer(getServerUrl() ?? (DEFAULT_SERVER || null)); }, []);
  useEffect(() => { start().then(() => setState('ready'), (e) => setState(e instanceof Error ? e : new Error(String(e)))); }, []);
  if (state instanceof Error) return <div className="center-screen" role="alert"><h1>No se pudo abrir la app</h1><p>{state.message}</p><button className="btn primary" onClick={() => location.reload()}>Reintentar</button></div>;
  if (state === 'loading') return <div className="main"><PageSkeleton /></div>;
  return <ErrorBoundary><MotionRoot><CoreProvider><Routes /></CoreProvider></MotionRoot></ErrorBoundary>;
}
