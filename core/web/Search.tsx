import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, errMsg } from './api.ts';
import { useBlock } from './CoreContext.tsx';
import { SearchIcon } from './icons.tsx';

type Hit = { id: string; kind: string; title: string; detail?: string; to: string };
const KIND: Record<string, string> = { tarea: 'Tarea', entrega: 'Entrega', estudio: 'Estudio', evento: 'Evento', parcial: 'Parcial', recuperatorio: 'Recuperatorio', final: 'Final' };

/** Búsqueda global de tareas y eventos (`/` o Ctrl+K). Cada módulo aporta sus resultados desde el servidor. */
export function Search({ open, onClose }: { open: boolean; onClose(): void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [error, setError] = useState('');
  const { off } = useBlock();

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); input.current?.select(); }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setHits(null); setError(''); return; }
    let live = true;
    const id = setTimeout(() => {
      api<Hit[]>('GET', `/api/search?q=${encodeURIComponent(t)}`).then(
        (r) => { if (live) { setHits(r); setError(''); } },
        (e) => { if (live) { setHits(null); setError(errMsg(e)); } },
      );
    }, 200);
    return () => { live = false; clearTimeout(id); };
  }, [q]);

  // Flechas: del campo al primer resultado y entre resultados.
  const move = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [input.current!, ...(dlg.current?.querySelectorAll<HTMLElement>('.search-list a') ?? [])];
    const next = items[Math.max(0, Math.min(items.length - 1, items.indexOf(document.activeElement as HTMLElement) + (e.key === 'ArrowDown' ? 1 : -1)))];
    e.preventDefault(); next?.focus();
  };
  const enter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') dlg.current?.querySelector<HTMLElement>('.search-list a')?.click(); };

  const msg = error || (off && !hits ? 'Sin conexión: la búsqueda necesita el servidor.' : q.trim().length < 2 ? 'Escribí al menos 2 letras.' : hits && !hits.length ? 'No se encontró nada.' : '');
  return (
    <dialog ref={dlg} className="search" aria-label="Buscar" onClose={onClose} onKeyDown={move} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
      <div className="search-box">
        <SearchIcon size={20} />
        <input ref={input} type="search" className="bare" placeholder="Buscar tareas y eventos…" aria-label="Buscar tareas y eventos" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={enter} />
        <button type="button" className="btn" onClick={() => dlg.current?.close()}>Cerrar</button>
      </div>
      <p className="muted search-msg" role="status">{hits?.length ? `${hits.length} ${hits.length === 1 ? 'resultado' : 'resultados'}` : msg}</p>
      {hits && hits.length > 0 && (
        <ul className="search-list">
          {hits.map((h) => (
            <li key={`${h.kind}:${h.id}`}>
              <Link to={h.to} onClick={() => dlg.current?.close()}>
                <span className="chip">{KIND[h.kind] ?? h.kind}</span>
                <span className="t">{h.title}</span>
                {h.detail && <small>{h.detail}</small>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
