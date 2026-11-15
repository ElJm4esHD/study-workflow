import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { popShared } from '../../../core/web/shared.ts';
import { api, errMsg } from '../../../core/web/api.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { PALETTE } from '../../../core/shared/palette.ts';
import { formatDate } from '../../../core/shared/dates.ts';
import { fmtDuration } from '../../../core/shared/duration.ts';
import { TODO_CATEGORIES } from '../../todo/shared.ts';
import { nameKey } from '../../../core/shared/normalize.ts';
import { EXAM_KINDS } from '../../calendar/shared.ts';
import type { EventKind } from '../../calendar/shared.ts';
import type { Preview } from '../server/preview.ts';
import type { PlanSummary } from '../server/index.ts';
import { neededMaterias } from './logic.ts';
import { ImportIcon, InboxIcon, ListIcon } from '../../../core/web/icons.tsx';
import { EmptyState, PageHeader } from '../../../core/web/ui.tsx';
import './import.css';

type Res = { mode: 'create'; color: string } | { mode: 'existing'; materiaId: string };

export function ImportPage() {
  const { materias, notify, reloadMaterias } = useCore();
  const { off, block } = useBlock();
  const navigate = useNavigate();
  const { key } = useLocation();
  const area = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [res, setRes] = useState<Record<string, Res>>({});
  const [busy, setBusy] = useState(false);

  // Texto de Compartir: va al campo, sin armar la vista previa. `key` cambia si llega otro con la página abierta.
  useEffect(() => { const t = popShared(); if (t) setText(t); }, [key]);

  async function fromClipboard() {
    if (block()) return;
    let t: string;
    try {
      t = await navigator.clipboard.readText();
      if (!t.trim()) throw new Error('vacío');
    } catch {
      notify('No se pudo leer el portapapeles. Pegalo abajo.');
      area.current?.focus();
      return;
    }
    setText(t);
    await doPreview(t);
  }

  async function doPreview(t = text) {
    if (block()) return;
    setBusy(true); setError(null); setPreview(null);
    try {
      const p = await api<Preview>('POST', '/api/import/preview', { text: t });
      setPreview(p);
      setChecked(new Set(p.items.filter((i) => !i.duplicate && !i.errors.length).map((i) => i.index)));
      setRes(Object.fromEntries(p.unresolvedMaterias.map((u) => [u.key, { mode: 'create', color: PALETTE[0]!.hex } as Res])));
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  }

  const needed = preview ? neededMaterias(preview, checked) : [];
  const ready = needed.every((u) => { const r = res[u.key]; return r && (r.mode === 'create' || r.materiaId); });

  async function save() {
    if (block()) return;
    setBusy(true);
    try {
      const materiasBody = Object.fromEntries(needed.map((u) => {
        const r = res[u.key]!;
        return [u.key, r.mode === 'create' ? { create: { name: u.name, color: r.color } } : { materiaId: r.materiaId }];
      }));
      await api<PlanSummary>('POST', '/api/import/commit', { text, include: [...checked], materias: materiasBody });
      notify(`Plan importado: ${checked.size} ítems.`);
      reloadMaterias();
      navigate('/importar/planes');
    } catch (e) { notify(errMsg(e)); }
    setBusy(false);
  }

  const days = new Map<string, Preview['items']>();
  for (const i of preview?.items ?? []) days.set(i.fecha, [...(days.get(i.fecha) ?? []), i]);
  const colorOfName = (n: string | null) => {
    if (!n) return 'transparent';
    const k = nameKey(n);
    const m = materias.find((x) => nameKey(x.name) === k);
    if (m) return m.color;
    const r = res[k];
    return r?.mode === 'create' ? r.color : 'transparent';
  };
  const setR = (key: string, r: Res) => setRes((s) => ({ ...s, [key]: r }));

  return (
    <>
      <PageHeader title="Importar plan" actions={<Link to="/importar/planes" className="btn"><ListIcon size={18} />Planes</Link>} />
      <div className="imp-split">
      <div className="card-group">
        <button className="btn primary imp-big" onClick={fromClipboard} disabled={busy} aria-disabled={off}><ImportIcon />Importar desde el portapapeles</button>
        <label className="form" style={{ display: 'flex' }}>
          O pegalo acá
          <textarea ref={area} className="imp-text" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <button className="btn" onClick={() => doPreview()} disabled={busy || !text.trim()} aria-disabled={off}>Ver vista previa</button>
      </div>
      <div>
      {error && <div className="imp-err" role="alert">{error}</div>}
      {!preview && !error && <EmptyState icon={InboxIcon} title="Todavía no hay vista previa">Copiá el plan que te armó Claude y tocá “Importar desde el portapapeles”. Vas a poder revisar cada ítem antes de guardar.</EmptyState>}
      {preview && (
        <>
          <h2 className="imp-title">{preview.plan.title ?? 'Plan sin título'}</h2>
          {needed.map((u) => {
            const r = res[u.key]!;
            return (
              <fieldset key={u.key} className="imp-materia">
                <legend>La materia "{u.name}" no existe</legend>
                <label><input type="radio" name={u.key} checked={r.mode === 'create'} onChange={() => setR(u.key, { mode: 'create', color: PALETTE[0]!.hex })} /> Crear con color</label>
                {r.mode === 'create' && (
                  <div className="swatches" role="radiogroup" aria-label={`Color de ${u.name}`}>
                    {PALETTE.map((c) => (
                      <button key={c.hex} type="button" role="radio" aria-checked={r.color === c.hex} aria-label={c.name}
                        className="swatch" style={{ background: c.hex }} onClick={() => setR(u.key, { mode: 'create', color: c.hex })} />
                    ))}
                  </div>
                )}
                <label><input type="radio" name={u.key} checked={r.mode === 'existing'} onChange={() => setR(u.key, { mode: 'existing', materiaId: '' })} /> Usar existente</label>
                {r.mode === 'existing' && (
                  <select aria-label={`Materia para ${u.name}`} value={r.materiaId} onChange={(e) => setR(u.key, { mode: 'existing', materiaId: e.target.value })}>
                    <option value="">Elegí una materia…</option>
                    {materias.filter((m) => !m.archived).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
              </fieldset>
            );
          })}
          {[...days].sort(([a], [b]) => a.localeCompare(b)).map(([d, items]) => (
            <section key={d}>
              <div className="eyebrow imp-day">{d ? formatDate(d) : 'Sin fecha'}</div>
              <ul className="list card imp-list">
                {items.map((i) => {
                  const exam = EXAM_KINDS.includes(i.tipo as EventKind);
                  return (
                    <li key={i.index} className="imp-row" style={{ ['--bar' as string]: colorOfName(i.materiaName) }}>
                      <label>
                        <input type="checkbox" disabled={i.errors.length > 0} checked={checked.has(i.index)}
                          onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(i.index); else n.delete(i.index); return n; })} />
                        <span className="imp-body">
                          <span className={`imp-tag${exam ? ' exam' : ''}`}>{i.tipo}{i.hora && ` · ${i.hora}`}{i.duracion && ` · ${fmtDuration(i.duracion)}`}{i.categoria !== 'tarea' && ` · ${TODO_CATEGORIES.find((c) => c.id === i.categoria)?.label}`}{i.subtareas.length > 0 && ` · ${i.subtareas.length} subtareas`}{i.duplicate && ' · Duplicado'}</span>
                          <span className={i.duplicate ? 'muted' : undefined}>{i.titulo}</span>
                          {i.errors.map((e) => <span key={e} className="error">{e}</span>)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <button className="btn primary imp-save" disabled={busy || !checked.size || !ready} aria-disabled={off} onClick={save}>
            Guardar {checked.size} ítems
          </button>
        </>
      )}
      </div>
      </div>
    </>
  );
}
