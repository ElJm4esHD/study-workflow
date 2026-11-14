/** Pantalla "padre" de una ruta sin historial: /todo/:id → /todo. null = pantalla principal (Atrás sale de la app). */
export function parentOf(pathname: string): string | null {
  const seg = pathname.split('/').filter(Boolean);
  return seg.length > 1 ? `/${seg[0]}` : null;
}
