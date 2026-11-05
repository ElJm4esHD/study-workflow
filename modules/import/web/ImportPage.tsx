import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, ApiError } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
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
import './import.css';

type Res = { mode: 'create'; color: string } | { mode: 'existing'; materiaId: string };
const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal.');

export function ImportPage() {
  const { materias, notify, reloadMaterias } = useCore();
  const navigate = useNavigate();
  const area = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [res, setRes] = useState<Record<string, Res>>({});
  const [busy, setBusy] = useState(false);

  async function fromClipboard() {
    let t: string;
    try {
      t = await navigator.clipboard.readText();
      if (!t.trim()) throw new Error('vacío');
    } catch {
      notify('No pude leer el portapapeles. Pegalo abajo.');
      area.current?.focus();
      return;
    }
    setText(t);
    await doPreview(t);
  }

  async function doPreview(t = text) {
    setBusy(true); setError(null); setPreview(null);
    try {
      const p = await api<Preview>('POST', '/api/import/preview', { text: t });
      setPreview(p);
      setChecked(new Set(p.items.filter((i) => !i.duplicate && !i.errors.length).map((i) => i.index)));
      setRes(Object.fromEntries(p.unresolvedMaterias.map((u) => [u.key, { mode: 'create', color: PALETTE[0]!.hex } as Res])));
    } catch (e) { setError(msg(e)); }
    setBusy(false);
  }

  const needed = preview ? neededMaterias(preview, checked) : [];
  const ready = needed.every((u) => { const r = res[u.key]; return r && (r.mode === 'create' || r.materiaId); });

  async function save() {
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
    } catch (e) { notify(msg(e)); }
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
      <h1>Importar</h1>
      <div className="card-group">
        <button className="btn primary imp-big" onClick={fromClipboard} disabled={busy}>Importar desde portapapeles</button>
        <label className="form" style={{ display: 'flex' }}>
          O pegalo acá
          <textarea ref={area} className="imp-text" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <button className="btn" onClick={() => doPreview()} disabled={busy || !text.trim()}>Ver vista previa</button>
        <Link to="/importar/planes">Ver planes importados</Link>
      </div>
      {error && <div className="imp-err" role="alert">{error}</div>}
      {preview && (
        <>
          <h2>{preview.plan.title ?? 'Plan sin título'}</h2>
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
              <h2>{d ? formatDate(d) : 'Sin fecha'}</h2>
              <ul className="list card imp-list">
                {items.map((i) => {
                  const exam = EXAM_KINDS.includes(i.tipo as EventKind);
                  return (
                    <li key={i.index} className="imp-row" style={{ ['--bar' as string]: colorOfName(i.materiaName) }}>
                      <label>
                        <input type="checkbox" disabled={i.errors.length > 0} checked={checked.has(i.index)}
                          onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(i.index); else n.delete(i.index); return n; })} />
                        <span className="imp-body">
                          <span className={`imp-tag${exam ? ' exam' : ''}`}>{i.tipo}{i.hora && ` · ${i.hora}`}{i.duracion && ` · ${fmtDuration(i.duracion)}`}{i.categoria !== 'tarea' && ` · ${TODO_CATEGORIES.find((c) => c.id === i.categoria)?.label}`}{i.duplicate && ' · Duplicado'}</span>
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
          <button className="btn primary imp-save" disabled={busy || !checked.size || !ready} onClick={save}>
            Guardar {checked.size} ítems
          </button>
        </>
      )}
    </>
  );
}
