import { useEffect, useRef, type ReactNode } from 'react';
import { useBlocker } from 'react-router';

/**
 * Avisa antes de salir con cambios sin guardar (navegación interna, Atrás del celu y cerrar la pestaña).
 * Devuelve el diálogo (renderizalo en el formulario) y `release()` para llamar justo antes de salir al guardar.
 */
export function useUnsaved(dirty: boolean): { dialog: ReactNode; release(): void } {
  const off = useRef(false);
  const blocker = useBlocker(() => dirty && !off.current);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (blocker.state === 'blocked' && !d.open) d.showModal();
    if (blocker.state !== 'blocked' && d.open) d.close();
  }, [blocker.state]);
  useEffect(() => {
    if (!dirty) return;
    const f = (e: BeforeUnloadEvent) => { if (!off.current) e.preventDefault(); };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [dirty]);
  const dialog = (
    <dialog ref={dlg} aria-labelledby="unsaved-t" onCancel={() => blocker.reset?.()}>
      <h2 id="unsaved-t">¿Salir sin guardar?</h2>
      <p>Los cambios que hiciste se van a perder.</p>
      <div className="row">
        <button type="button" className="btn" onClick={() => blocker.reset?.()}>Seguir editando</button>
        <button type="button" className="btn danger" onClick={() => blocker.proceed?.()}>Salir sin guardar</button>
      </div>
    </dialog>
  );
  return { dialog, release: () => { off.current = true; } };
}
