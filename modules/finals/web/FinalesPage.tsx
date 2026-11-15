import { useMemo, useState } from 'react';
import { api, useApi, errMsg } from '../../../core/web/api.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { addDays, formatDate, weekdayOf } from '../../../core/shared/dates.ts';
import { nameKey } from '../../../core/shared/normalize.ts';
import { combos, daysBetween, matchMateria, ORDENES, parseFinales, type Combo, type FinalDate, type Filters, type FinalsData, type ParsedMateria } from '../shared.ts';
import { AnimatePresence, m } from 'motion/react';
import { CheckIcon, ChevronIcon, CloseIcon, FinalIcon, ImportIcon, InboxIcon, PlusIcon } from '../../../core/web/icons.tsx';
import { useMotion } from '../../../core/web/motion.tsx';
import { vibrate } from '../../../core/web/haptics.ts';
import { EmptyState, PageHeader, Skeleton, ErrorState } from '../../../core/web/ui.tsx';
import './finals.css';

type Plan = Filters & { noRinde: string[] };
const PLAN0: Plan = { minDias: 1, antes: null, excluir: [], orden: 'separacion', noRinde: [] };
const SHOWN = 50;
const dm = (d: string) => formatDate(d).slice(0, 5);
const when = (d: { date: string; time: string | null }) => `${dm(d.date)}${d.time ? ` ${d.time}` : ''}`;
const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

/** Pegar el JSON de la skill → vista previa → confirmar. */
function Importar({ onDone }: { onDone(): void }) {
  const { materias, notify } = useCore();
  const { off, block } = useBlock();
  const [text, setText] = useState('');
  const [map, setMap] = useState<Record<string, string>>({}); // nameKey → id de materia, '' = saltear
  const parsed = useMemo(() => (text.trim() ? parseFinales(text) : null), [text]);
  const target = (m: ParsedMateria) => map[nameKey(m.name)] ?? matchMateria(m.name, materias)?.id ?? '';
  const usable = parsed?.ok ? parsed.materias.filter((m) => m.name && m.fechas.length) : [];

  async function paste() {
    try { setText(await navigator.clipboard.readText()); } catch { notify('No pude leer el portapapeles: pegalo a mano.'); }
  }
  async function save() {
    if (block()) return;
    try {
      const body = { text, map: Object.fromEntries(usable.map((m) => [nameKey(m.name), target(m) || null])) };
      const r = await api<{ materias: number; fechas: number }>('POST', '/api/finals/import', body);
      notify(`Importé ${r.fechas} fechas de ${r.materias} ${r.materias === 1 ? 'materia' : 'materias'}.`);
      onDone();
    } catch (e) { notify(errMsg(e)); }
  }

  return (
    <div className="card form">
      <div className="card-head"><h3>Importar fechas</h3></div>
      <button type="button" className="btn" onClick={paste}>Pegar del portapapeles</button>
      <label>O pegá acá el mensaje de Claude
        <textarea className="fin-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      </label>
      {parsed && !parsed.ok && <p className="error" role="alert">{parsed.error}</p>}
      {parsed?.ok && parsed.materias.map((m, i) => (
        <div key={i} className="fin-prev">
          <strong>{m.name || 'Sin nombre'}</strong>
          {m.name && m.fechas.length > 0 && (
            <select aria-label={`Materia para ${m.name}`} value={target(m)} onChange={(e) => setMap((s) => ({ ...s, [nameKey(m.name)]: e.target.value }))}>
              <option value="">No importar</option>
              {materias.filter((x) => !x.archived).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
          <span className="muted">{m.fechas.map((f) => when({ date: f.fecha, time: f.hora })).join(' · ')}</span>
          {m.errors.map((e) => <span key={e} className="error">{e}</span>)}
        </div>
      ))}
      {usable.length > 0 && <p className="muted">Importar reemplaza las fechas que ya tengan esas materias.</p>}
      <div className="row">
        <button type="button" className="btn" onClick={onDone}>Cancelar</button>
        <button type="button" className="btn primary" disabled={!usable.some((m) => target(m))} aria-disabled={off} onClick={save}>Importar</button>
      </div>
    </div>
  );
}

/** Alta o edición de una fecha posible. */
function FechaForm({ materiaId, item, onDone }: { materiaId: string; item?: FinalDate; onDone(): void }) {
  const { notify } = useCore();
  const { off, block } = useBlock();
  const [date, setDate] = useState(item?.date ?? '');
  const [time, setTime] = useState(item?.time ?? '');
  async function run(fn: () => Promise<unknown>) {
    if (block()) return;
    try { await fn(); onDone(); } catch (e) { notify(errMsg(e)); }
  }
  const body = { materiaId, date, time: time || null };
  return (
    <form className="fin-form" onSubmit={(e) => { e.preventDefault(); void run(() => (item ? api('PATCH', `/api/finals/dates/${item.id}`, body) : api('POST', '/api/finals/dates', body))); }}>
      <input type="date" aria-label="Fecha" value={date} onChange={(e) => setDate(e.target.value)} required />
      <input type="time" aria-label="Hora (opcional)" value={time} onChange={(e) => setTime(e.target.value)} />
      <button className="btn primary" aria-disabled={off}>Guardar</button>
      {item && <button type="button" className="btn danger" aria-disabled={off} onClick={() => void run(() => api('DELETE', `/api/finals/dates/${item.id}`))}>Borrar</button>}
      <button type="button" className="btn" onClick={onDone}>Cancelar</button>
    </form>
  );
}

export function FinalesPage() {
  const { materias, settings, patchSettings, notify } = useCore();
  const { off, block } = useBlock();
  const { data, error, reload } = useApi<FinalsData>('/api/finals');
  const plan: Plan = { ...PLAN0, ...(settings['finals.plan'] as Partial<Plan> | undefined) };
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<{ materiaId: string; id?: string } | null>(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [shown, setShown] = useState(SHOWN);
  const { spring } = useMotion();

  const dates = data?.dates ?? [];
  const active = materias.filter((m) => !m.archived || dates.some((d) => d.materiaId === m.id));
  const mat = (id: string) => materias.find((m) => m.id === id);
  const rinde = active.filter((m) => !plan.noRinde.includes(m.id) && dates.some((d) => d.materiaId === m.id));
  const groups = rinde.map((m) => dates.filter((d) => d.materiaId === m.id));
  const result = useMemo(() => combos(groups, plan), [JSON.stringify(groups), JSON.stringify(plan)]); // eslint-disable-line
  // Escala común a todas las filas: de la primera a la última fecha posible.
  const all = groups.flat().map((d) => d.date).sort();
  const min = all[0] ?? '', span = Math.max(1, all.length ? daysBetween(min, all.at(-1)!) : 1);
  const pos = (d: string) => `${(daysBetween(min, d) / span) * 100}%`;
  const mondays = all.length ? Array.from({ length: span + 1 }, (_, i) => addDays(min, i)).filter((d) => weekdayOf(d) === 1) : [];
  const isChosen = (c: Combo) => !!data && data.chosen.length === c.picks.length
    && c.picks.every((p) => data.chosen.some((x) => x.materiaId === p.materiaId && x.date === p.date && x.time === p.time));

  async function setPlan(p: Partial<Plan>) {
    if (block()) return;
    setShown(SHOWN);
    try { await patchSettings({ 'finals.plan': { ...plan, ...p } }); } catch (e) { notify(errMsg(e)); }
  }
  async function choose(c: Combo | null) {
    if (block()) return;
    try {
      if (c) await api('PUT', '/api/finals/chosen', { dateIds: c.picks.map((p) => p.id) }); else await api('DELETE', '/api/finals/chosen');
      vibrate(c ? 'success' : 'tick');
      notify(c ? 'Listo: los finales están en el calendario.' : 'Saqué los finales del calendario.');
      reload();
    } catch (e) { notify(errMsg(e)); }
  }
  const done = () => { setEditing(null); setImporting(false); reload(); };

  return (
    <>
      <PageHeader title="Finales" sub={data && rinde.length ? `${rinde.length} ${rinde.length === 1 ? 'materia' : 'materias'} para rendir` : undefined}
        actions={!importing && <button className="btn" aria-disabled={off} onClick={() => { if (!block()) setImporting(true); }}><ImportIcon size={18} />Importar fechas</button>} />
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {!data && !error && <div className="card skel-card" role="status" aria-label="Cargando"><Skeleton w="40%" h={18} /><Skeleton /><Skeleton w="70%" /><Skeleton w="85%" /></div>}
      {data && <div className="fin-page">
        <div className="fin-side">
          {importing && <Importar onDone={done} />}
          <section className="card">
            <div className="card-head"><h3>Fechas posibles</h3></div>
            {!active.length && <EmptyState icon={InboxIcon} title="Sin materias">Creá tus materias en Ajustes.</EmptyState>}
            {active.map((m) => {
              const own = dates.filter((d) => d.materiaId === m.id);
              const on = !plan.noRinde.includes(m.id);
              return (
                <div key={m.id} className="fin-mat" style={materiaVars(m.color)}>
                  <div className="fin-mat-head">
                    <span className="dot" aria-hidden="true" /><strong>{m.name}</strong>
                    {own.length > 0 && (
                      <label className="switch" title="Rindo">
                        <input type="checkbox" role="switch" checked={on} aria-label={`Rindo ${m.name}`}
                          onChange={() => void setPlan({ noRinde: on ? [...plan.noRinde, m.id] : plan.noRinde.filter((x) => x !== m.id) })} />
                        <span className="track" aria-hidden="true" />
                      </label>
                    )}
                  </div>
                  <div className="pills">
                    {own.map((d) => (
                      <button key={d.id} type="button" className="pill" aria-pressed={editing?.id === d.id} aria-label={`Editar ${when(d)}`}
                        onClick={() => setEditing({ materiaId: m.id, id: d.id })}>{when(d)}</button>
                    ))}
                    <button type="button" className="pill fin-add" aria-label={`Agregar fecha a ${m.name}`} onClick={() => setEditing({ materiaId: m.id })}><PlusIcon size={16} />Fecha</button>
                  </div>
                  {editing?.materiaId === m.id && <FechaForm key={editing.id ?? 'new'} materiaId={m.id} item={own.find((d) => d.id === editing.id)} onDone={done} />}
                </div>
              );
            })}
          </section>
          <details className="card fin-filters">
            <summary>
              <span><strong>Filtros y orden</strong><small>mín. {dias(plan.minDias)}{plan.antes ? ` · hasta ${dm(plan.antes)}` : ''}{plan.excluir.length ? ` · ${plan.excluir.length} excluidas` : ''} · {ORDENES.find((o) => o.id === plan.orden)?.label}</small></span>
              <ChevronIcon size={20} />
            </summary>
            <div className="form">
            <label>Mínimo de días entre finales
              <input type="number" inputMode="numeric" min={0} max={60} value={plan.minDias}
                onChange={(e) => void setPlan({ minDias: Math.max(0, Math.min(60, Math.round(Number(e.target.value)) || 0)) })} />
            </label>
            <label>Terminar el día (o antes)
              <input type="date" value={plan.antes ?? ''} onChange={(e) => void setPlan({ antes: e.target.value || null })} />
            </label>
            <div className="field" role="group" aria-label="Excluir fechas">
              <span>Excluir fechas (un día o un rango)</span>
              {plan.excluir.length > 0 && (
                <div className="pills">
                  {plan.excluir.map((r, i) => (
                    <button key={i} type="button" className="pill" aria-label={`Quitar exclusión ${dm(r.from)} a ${dm(r.to)}`}
                      onClick={() => void setPlan({ excluir: plan.excluir.filter((_, k) => k !== i) })}>{r.from === r.to ? dm(r.from) : `${dm(r.from)} a ${dm(r.to)}`}<CloseIcon size={16} className="pill-x" /></button>
                  ))}
                </div>
              )}
              <div className="fin-form">
                <input type="date" aria-label="Excluir desde" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
                <input type="date" aria-label="Excluir hasta (opcional)" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
                <button type="button" className="btn" disabled={!range.from || (!!range.to && range.to < range.from)}
                  onClick={() => { void setPlan({ excluir: [...plan.excluir, { from: range.from, to: range.to || range.from }] }); setRange({ from: '', to: '' }); }}>Excluir</button>
              </div>
            </div>
            <div className="field">
              <span>Orden</span>
              <div className="radios" role="radiogroup" aria-label="Orden">
                {ORDENES.map((o) => <button key={o.id} type="button" role="radio" aria-checked={plan.orden === o.id} onClick={() => void setPlan({ orden: o.id })}><span className="r" /><span>{o.label}</span></button>)}
              </div>
            </div>
            </div>
          </details>
        </div>

        <div className="fin-main">
          {data && data.chosen.length > 0 && (
            <section className="card fin-chosen">
              <div><strong>Elegida, ya está en el calendario</strong>
                <span className="muted">{[...data.chosen].sort((a, b) => a.date.localeCompare(b.date)).map((c) => `${mat(c.materiaId)?.sigla ?? '?'} ${when(c)}`).join(' · ')}</span></div>
              <button className="btn" aria-disabled={off} onClick={() => void choose(null)}>Deshacer</button>
            </section>
          )}
          <div className="eyebrow fin-count">{rinde.length < 1 ? 'Combinaciones' : `${result.list.length}${result.truncated ? '+' : ''} ${result.list.length === 1 ? 'combinación' : 'combinaciones'}`}</div>
          {data && !rinde.length && <EmptyState icon={FinalIcon} title="Sin fechas cargadas">Cargá las fechas posibles de las materias que vas a rendir, a mano o con "Importar fechas".</EmptyState>}
          {rinde.length > 0 && !result.list.length && <EmptyState icon={InboxIcon} title="Ninguna combinación">Ninguna cumple los filtros. Probá con menos días entre finales o sacá exclusiones.</EmptyState>}
          {result.truncated && <p className="muted">Hay demasiadas combinaciones: usá los filtros para achicar.</p>}
          {result.list.length > 0 && (
            <div className="fin-axis" aria-hidden="true"><div className="fin-line">{mondays.map((d) => <span key={d} style={{ left: pos(d) }}>{dm(d)}</span>)}</div></div>
          )}
          <ol className="fin-list">
            <AnimatePresence initial={false}>
            {result.list.slice(0, shown).map((c, i) => {
              const chosen = isChosen(c);
              return (
                <m.li key={c.picks.map((p) => p.id).join()} className={chosen ? 'card fin-combo chosen' : 'card fin-combo'}
                  layout="position" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={spring('gentle')}>
                  <div className="fin-top">
                    <span className="fin-n">{i + 1}</span>
                    <span className="fin-sum">{c.minGap !== null && <strong>mín. {dias(c.minGap)}</strong>} {c.first === c.last ? dm(c.first) : `del ${dm(c.first)} al ${dm(c.last)}`}</span>
                    {chosen ? <span className="chip fin-chosen-tag"><CheckIcon size={14} />Elegida</span> : <button className="btn" aria-disabled={off} onClick={() => void choose(c)}>Elegir</button>}
                  </div>
                  <div className="fin-line" aria-hidden="true">
                    {mondays.map((d) => <i key={d} style={{ left: pos(d) }} />)}
                    {c.picks.map((p, k) => <b key={p.id} className={k % 2 ? 'chip solid low' : 'chip solid'} style={{ ...materiaVars(mat(p.materiaId)?.color ?? ''), left: pos(p.date) }}>{mat(p.materiaId)?.sigla}</b>)}
                  </div>
                  <div className="fin-detail">
                    {c.picks.map((p, k) => (
                      <span key={p.id} style={materiaVars(mat(p.materiaId)?.color ?? '')}>
                        {k > 0 && <em>{dias(c.gaps[k - 1]!)}</em>}<span className="dot" aria-hidden="true" /> {mat(p.materiaId)?.sigla} {when(p)}
                      </span>
                    ))}
                  </div>
                </m.li>
              );
            })}
            </AnimatePresence>
          </ol>
          {result.list.length > shown && <button className="btn" onClick={() => setShown(shown + SHOWN)}>Ver más</button>}
        </div>
      </div>}
    </>
  );
}
