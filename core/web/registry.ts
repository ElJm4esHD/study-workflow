import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';

export interface WebModule {
  id: string;
  name: string;
  icon: ComponentType;
  routes: RouteObject[];
  /** `more`: en el celu va dentro de "Más" en vez de la barra de abajo. */
  nav?: { path: string; order: number; more?: boolean };
  settings?: ComponentType;
  /** Título de la sección en Ajustes (por defecto, `name`). */
  settingsTitle?: string;
  dashboard?: { id: string; order: number; column: 'left' | 'right'; Card: ComponentType }[];
  requires?: string[];
  /** Ruta que recibe el texto compartido desde Android (Compartir). */
  shareTarget?: string;
  /** URLs GET que el núcleo pide al arrancar con conexión, para tener copia offline. */
  prefetch?: () => string[];
}

/** Módulos activos: los habilitados más sus `requires` registrados; un `requires` sin parte web se ignora. */
export function resolveEnabled(all: WebModule[], isEnabled: (id: string) => boolean): WebModule[] {
  const on = new Set(all.filter((m) => isEnabled(m.id)).map((m) => m.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const m of all) if (on.has(m.id)) for (const r of m.requires ?? []) {
      if (!on.has(r) && all.some((x) => x.id === r)) { on.add(r); grew = true; }
    }
  }
  return all.filter((m) => on.has(m.id));
}

export type DashboardCard = NonNullable<WebModule['dashboard']>[number];

/** Tarjetas de Inicio de los módulos dados: `all` por `order` (celu, una columna); `left`/`right` para la compu. */
export function dashboardCards(mods: WebModule[]): { left: DashboardCard[]; right: DashboardCard[]; all: DashboardCard[] } {
  const all = mods.flatMap((m) => m.dashboard ?? []).sort((a, b) => a.order - b.order);
  return { all, left: all.filter((c) => c.column === 'left'), right: all.filter((c) => c.column === 'right') };
}

/** URLs a precargar: las de los módulos más las del núcleo, sin repetir. */
export function prefetchUrls(mods: WebModule[]): string[] {
  return [...new Set([...mods.flatMap((m) => m.prefetch?.() ?? []), '/api/materias', '/api/settings'])];
}
