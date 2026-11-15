import { useMemo, useState } from 'react';
import { api, useApi, errMsg } from '../../../core/web/api.ts';
import { DateField, TimeField } from '../../../core/web/DateTime.tsx';
import { firstInvalid, useSubmit } from '../../../core/web/useSubmit.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { addDays, formatDate, weekdayOf } from '../../../core/shared/dates.ts';
import { nameKey } from '../../../core/shared/normalize.ts';
import { combos, daysBetween, matchMateria, ORDENES, parseFinales, type Combo, type FinalDate, type Filters, type FinalsData, type ParsedMateria } from '../shared.ts';
import { AnimatePresence, m } from 'motion/react';
import { CheckIcon, CloseIcon, FinalIcon, ImportIcon, InboxIcon, PlusIcon } from '../../../core/web/icons.tsx';
import { NEUTRAL } from '../../../core/shared/palette.ts';
import { vibrate } from '../../../core/web/haptics.ts';
import { EmptyState, PageHeader, Skeleton, ErrorState, Sheet, radioKeys } from '../../../core/web/ui.tsx';
import './finals.css';

type Plan = Filters & { noRinde: string[] };
const PLAN0: Plan = { minDias: 1, antes: null, excluir: [], orden: 'separacion', noRinde: [] };
const SHOWN = 10;
const dm = (d: string) => formatDate(d).slice(0, 5);
const when = (d: { date: string; time: string | null }) => `${dm(d.date)}${d.time ? ` ${d.time}` : ''}`;
const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

/** Pegar el JSON de la skill → vista previa → confirmar (en una hoja). */
function Importar({ onDone }: { onDone(): void }) {
  const { materias, notify } = useCore();
  const { off, block } = useBlock();
  const [text, setText] = useState('');
  const [map, setMap] = useState<Record<string, string>>({}); // nameKey → id de materia, '' = saltear
  const parsed = useMemo(() => (text.trim() ? parseFinales(text) : null), [text]);
  const target = (m: ParsedMateria) => map[nameKey(m.name)] ?? matchMateria(m.name, materias)?.id ?? '';
  const usable = parsed?.ok ? parsed.materias.filter((m) => m.name && m.fechas.length) : [];

  async function paste() {
    try { setText(await navigator.clipboard.readText()); } catch { notify('No se pudo leer el portapapeles. Pegalo a mano.'); }
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
    <div className="form">
      <h2 className="sheet-title">Importar fechas</h2>
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
  const { off, block } = useBlock();
  const [date, setDate] = useState(item?.date ?? '');
  const [time, setTime] = useState(item?.time ?? '');
  const sub = useSubmit();
  async function run(fn: () => Promise<unknown>) {
    if (block()) return;
    if (await sub.run(fn)) onDone();
  }
  const body = { materiaId, date, time: time || null };
  return (
    <form className="fin-form" noValidate onSubmit={(e) => { e.preventDefault(); const bad = firstInvalid(e.currentTarget); if (bad) { sub.fail(bad); return; } void run(() => (item ? api('PATCH', `/api/finals/dates/${item.id}`, body) : api('POST', '/api/finals/dates', body))); }}>
      <DateField label="Fecha" value={date} onChange={setDate} required />
      <TimeField label="Hora (opcional)" value={time} onChange={setTime} />
      {sub.error && <p className="error" role="alert">{sub.error}</p>}
      <button className="btn primary" aria-disabled={off} disabled={sub.saving}>{sub.saving ? 'Guardando…' : 'Guardar'}</button>
      {item && <button type="button" className="btn danger" aria-disabled={off} onClick={() => void run(() => api('DELETE', `/api/finals/dates/${item.id}`))}>Borrar</button>}
      <button type="button" className="btn" onClick={onDone}>Cancelar</button>
    </form>
  );
}

type Sheets = { kind: 'importar' } | { kind: 'fecha'; materiaId: string; id?: string } | { kind: 'filtro'; f: 'minDias' | 'antes' | 'excluir' | 'orden' } | null;
const FILTRO_TITULO = { minDias: 'Días mínimos entre finales', antes: 'Terminar antes de', excluir: 'Excluir días', orden: 'Ordenar combinaciones' } as const;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Mes dibujado con los finales de una combinación (en el color de la materia) y los días excluidos rayados. */
function MiniMes({ first, picks, excluir, sigla, color }: {
  first: string; picks: FinalDate[]; excluir: Filters['excluir']; sigla(id: string): string; color(id: string): string;
}) {
  const start = addDays(first, 1 - weekdayOf(first));
  const month = first.slice(0, 7);
  const last = addDays(new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 1)).toISOString().slice(0, 10), -1); // día antes del 1 del mes siguiente
  const weeks = Math.ceil((daysBetween(start, last) + 1) / 7);
  return (
    <figure className="fin-mes">
      <figcaption>{MESES[+month.slice(5) - 1]} {month.slice(0, 4)}</figcaption>
      <div className="fin-mes-grid">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d} className="dh" aria-hidden="true">{d}</span>)}
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const d = addDays(start, i);
          if (d.slice(0, 7) !== month) return <span key={d} />;
          const p = picks.find((x) => x.date === d);
          const off = excluir.some((r) => r.from <= d && d <= r.to);
          return p
            ? <span key={d} className="d f" style={materiaVars(color(p.materiaId))}>{+d.slice(8)}<b>{sigla(p.materiaId)}</b></span>
            : <span key={d} className={off ? 'd x' : 'd'}>{+d.slice(8)}</span>;
        })}
      </div>
    </figure>
  );
}

export function FinalesPage() {
  const { materias, settings, patchSettings, notify } = useCore();
  const { off, block } = useBlock();
  const { data, error, reload } = useApi<FinalsData>('/api/finals');
  const plan: Plan = { ...PLAN0, ...(settings['finals.plan'] as Partial<Plan> | undefined) };
  const [sheet, setSheet] = useState<Sheets>(null);
  const [focus, setFocus] = useState(0); // combinación que se ve arriba con su mes
  const [range, setRange] = useState({ from: '', to: '' });
  const [shown, setShown] = useState(SHOWN);

  const dates = data?.dates ?? [];
  const active = materias.filter((m) => !m.archived || dates.some((d) => d.materiaId === m.id));
  const mat = (id: string) => materias.find((m) => m.id === id);
  const sigla = (id: string) => mat(id)?.sigla ?? '?';
  const color = (id: string) => mat(id)?.color ?? NEUTRAL.hex;
  const on = active.filter((m) => !plan.noRinde.includes(m.id));
  const rinde = on.filter((m) => dates.some((d) => d.materiaId === m.id));
  const groups = rinde.map((m) => dates.filter((d) => d.materiaId === m.id));
  const result = useMemo(() => combos(groups, plan), [JSON.stringify(groups), JSON.stringify(plan)]); // eslint-disable-line
  const best = result.list[Math.min(focus, result.list.length - 1)];
  const isChosen = (c: Combo) => !!data && data.chosen.length === c.picks.length
    && c.picks.every((p) => data.chosen.some((x) => x.materiaId === p.materiaId && x.date === p.date && x.time === p.time));
  const pickOf = (c: Combo, id: string) => c.picks.find((p) => p.materiaId === id);
  const months = best ? [...new Set(best.picks.map((p) => p.date.slice(0, 7)))].sort() : [];

  async function setPlan(p: Partial<Plan>) {
    if (block()) return;
    setShown(SHOWN); setFocus(0);
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
  const done = () => { setSheet(null); reload(); };
  const chooseBtn = (c: Combo) => isChosen(c)
    ? <span className="fin-cal"><span className="chip fin-chosen-tag"><CheckIcon size={14} />En el calendario</span><button type="button" className="btn" aria-disabled={off} onClick={() => void choose(null)}>Deshacer</button></span>
    : <button type="button" className="btn primary" aria-disabled={off} onClick={() => void choose(c)}>Elegir</button>;
  const rangeTxt = (c: Combo) => (c.first === c.last ? dm(c.first) : `${dm(c.first).slice(0, 2)}/${dm(c.first).slice(3)} → ${dm(c.last)}`);
  const editing = sheet?.kind === 'fecha' ? sheet : null;

  return (
    <>
      <PageHeader title="Finales" sub={data && rinde.length ? `${rinde.length} ${rinde.length === 1 ? 'materia' : 'materias'} para rendir` : undefined}
        actions={<button className="btn" aria-disabled={off} onClick={() => { if (!block()) setSheet({ kind: 'importar' }); }}><ImportIcon size={18} />Importar fechas</button>} />
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {!data && !error && <div className="card skel-card" role="status" aria-label="Cargando"><Skeleton w="40%" h={18} /><Skeleton /><Skeleton w="70%" /><Skeleton w="85%" /></div>}
      {data && <div className="fin-page">
        <div className="fin-side">
          <section className="card" aria-labelledby="fin-1">
            <div className="fin-h"><h2 id="fin-1"><span className="fin-step">1</span>¿Qué rendís?</h2><small>{on.length} de {active.length}</small></div>
            {!active.length && <EmptyState icon={InboxIcon} title="Sin materias">Creá tus materias en Ajustes.</EmptyState>}
            <div className="fin-mats">
              {active.map((m) => {
                const isOn = !plan.noRinde.includes(m.id);
                const n = dates.filter((d) => d.materiaId === m.id).length;
                return (
                  <button key={m.id} type="button" className="fin-mt" aria-pressed={isOn} style={materiaVars(m.color)} title={m.name}
                    aria-label={`${m.name}: ${n ? `${n} ${n === 1 ? 'fecha' : 'fechas'}` : 'sin fechas'}`}
                    onClick={() => void setPlan({ noRinde: isOn ? [...plan.noRinde, m.id] : plan.noRinde.filter((x) => x !== m.id) })}>
                    {m.sigla}<em>{n || '—'}</em>
                  </button>
                );
              })}
            </div>
          </section>
          {on.length > 0 && (
            <section className="card" aria-labelledby="fin-2">
              <div className="fin-h"><h2 id="fin-2"><span className="fin-step">2</span>Fechas posibles</h2><small>{dates.filter((d) => on.some((m) => m.id === d.materiaId)).length} fechas</small></div>
              {on.map((m) => {
                const own = dates.filter((d) => d.materiaId === m.id);
                return (
                  <div key={m.id} className="fin-row" style={materiaVars(m.color)}>
                    <span className="fin-sig" title={m.name}>{m.sigla}</span>
                    <div className="fin-dates">
                      {own.map((d) => (
                        <button key={d.id} type="button" className="fin-dp" aria-label={`Editar ${m.sigla} ${when(d)}`} onClick={() => setSheet({ kind: 'fecha', materiaId: m.id, id: d.id })}>{when(d)}</button>
                      ))}
                      {!own.length && <span className="fin-none">Sin fechas</span>}
                      <button type="button" className="fin-dp add" aria-label={`Agregar fecha a ${m.name}`} onClick={() => setSheet({ kind: 'fecha', materiaId: m.id })}><PlusIcon size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </div>

        <section className="card fin-main" aria-labelledby="fin-3">
          <div className="fin-h"><h2 id="fin-3"><span className="fin-step">3</span>Combinaciones</h2>
            <small>{rinde.length ? `${result.list.length}${result.truncated ? '+' : ''}` : ''}</small></div>
          <div className="fin-filters" role="group" aria-label="Filtros">
            <button type="button" className="fin-fl" aria-pressed={plan.minDias > 0} onClick={() => setSheet({ kind: 'filtro', f: 'minDias' })}>Mín. {dias(plan.minDias)}</button>
            <button type="button" className="fin-fl" aria-pressed={!!plan.antes} onClick={() => setSheet({ kind: 'filtro', f: 'antes' })}>{plan.antes ? `Hasta ${dm(plan.antes)}` : 'Hasta…'}</button>
            <button type="button" className="fin-fl" aria-pressed={plan.excluir.length > 0} onClick={() => setSheet({ kind: 'filtro', f: 'excluir' })}>{plan.excluir.length ? `${plan.excluir.length} excluidos` : 'Excluir días'}</button>
            <button type="button" className="fin-fl" aria-pressed="false" onClick={() => setSheet({ kind: 'filtro', f: 'orden' })}>Orden: {ORDENES.find((o) => o.id === plan.orden)?.label.toLowerCase()}</button>
          </div>
          {!rinde.length && <EmptyState icon={FinalIcon} title="Sin fechas cargadas">Elegí qué rendís y cargá las fechas posibles, a mano o con "Importar fechas".</EmptyState>}
          {rinde.length > 0 && !result.list.length && <EmptyState icon={InboxIcon} title="Ninguna combinación">Ninguna cumple los filtros. Probá con menos días entre finales o sacá exclusiones.</EmptyState>}
          {result.truncated && <p className="muted">Hay demasiadas combinaciones: usá los filtros para achicar.</p>}
          {best && (
            <div className="fin-grid">
              <div className={isChosen(best) ? 'fin-best chosen' : 'fin-best'}>
                <div className="fin-best-top"><span className="fin-badge">{focus === 0 ? 'La mejor' : `Opción ${focus + 1}`}</span>{chooseBtn(best)}</div>
                <div className="fin-kpis">
                  <span><b>{best.minGap === null ? '—' : dias(best.minGap)}</b>mín. entre finales</span>
                  <span><b>{rangeTxt(best)}</b>{dias(daysBetween(best.first, best.last) + 1)} en total</span>
                </div>
                {months.map((mo) => <MiniMes key={mo} first={`${mo}-01`} picks={best.picks} excluir={plan.excluir} sigla={sigla} color={color} />)}
                <ul className="fin-best-list">
                  {best.picks.map((p) => <li key={p.id} style={materiaVars(color(p.materiaId))}><span className="dot" aria-hidden="true" />{mat(p.materiaId)?.name ?? '?'}<span>{when(p)}</span></li>)}
                </ul>
              </div>
              <div className="fin-alts" style={{ ['--cols' as string]: rinde.length }}>
                <div className="fin-alt head" aria-hidden="true"><span>#</span><span>Mín.</span><span>Fechas</span>{rinde.map((m) => <span key={m.id}>{m.sigla}</span>)}<span /></div>
                <ol>
                  <AnimatePresence initial={false}>
                    {result.list.slice(0, shown).map((c, i) => (
                      <m.li key={c.picks.map((p) => p.id).join()} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className={[ 'fin-alt', i === focus && 'on', isChosen(c) && 'chosen'].filter(Boolean).join(' ')}>
                        <button type="button" className="fin-alt-main" aria-pressed={i === focus} aria-label={`Ver la opción ${i + 1}: mínimo ${c.minGap === null ? '—' : dias(c.minGap)}, ${rangeTxt(c)}`} onClick={() => setFocus(i)}>
                          <span className="n">{i + 1}</span><span>{c.minGap === null ? '—' : dias(c.minGap)}</span><span>{rangeTxt(c)}</span>
                          {rinde.map((mt) => {
                            const p = pickOf(c, mt.id)!;
                            const diff = i !== focus && best && pickOf(best, mt.id)?.id !== p.id;
                            return <span key={mt.id} className={diff ? 'pk diff' : 'pk'} style={materiaVars(mt.color)}><i>{mt.sigla} </i>{dm(p.date)}</span>;
                          })}
                        </button>
                        {chooseBtn(c)}
                      </m.li>
                    ))}
                  </AnimatePresence>
                </ol>
                {result.list.length > shown && <button className="btn" onClick={() => setShown(shown + SHOWN)}>Ver más</button>}
              </div>
            </div>
          )}
        </section>
      </div>}

      <Sheet open={!!sheet} onClose={() => setSheet(null)}
        label={sheet?.kind === 'importar' ? 'Importar fechas' : sheet?.kind === 'fecha' ? 'Fecha posible' : sheet?.kind === 'filtro' ? FILTRO_TITULO[sheet.f] : ''}>
        {sheet?.kind === 'importar' && <Importar onDone={done} />}
        {editing && (
          <div className="form">
            <h2 className="sheet-title">{editing.id ? 'Editar fecha' : 'Nueva fecha'} · {mat(editing.materiaId)?.name}</h2>
            <FechaForm key={editing.id ?? 'new'} materiaId={editing.materiaId} item={dates.find((d) => d.id === editing.id)} onDone={done} />
          </div>
        )}
        {sheet?.kind === 'filtro' && (
          <div className="form">
            <h2 className="sheet-title">{FILTRO_TITULO[sheet.f]}</h2>
            {sheet.f === 'minDias' && (
              <label>Mínimo de días entre un final y el siguiente
                <input type="number" inputMode="numeric" min={0} max={60} value={plan.minDias}
                  onChange={(e) => void setPlan({ minDias: Math.max(0, Math.min(60, Math.round(Number(e.target.value)) || 0)) })} />
              </label>
            )}
            {sheet.f === 'antes' && <>
              <DateField label="Terminar el día (o antes)" value={plan.antes ?? ''} onChange={(v) => void setPlan({ antes: v || null })} />
              {plan.antes && <button type="button" className="btn" onClick={() => void setPlan({ antes: null })}>Sin límite</button>}
            </>}
            {sheet.f === 'excluir' && <>
              {plan.excluir.length > 0 && (
                <div className="pills">
                  {plan.excluir.map((r, i) => (
                    <button key={i} type="button" className="pill" aria-label={`Quitar exclusión ${dm(r.from)} a ${dm(r.to)}`}
                      onClick={() => void setPlan({ excluir: plan.excluir.filter((_, k) => k !== i) })}>{r.from === r.to ? dm(r.from) : `${dm(r.from)} a ${dm(r.to)}`}<CloseIcon size={16} className="pill-x" /></button>
                  ))}
                </div>
              )}
              <DateField label="Excluir desde" value={range.from} onChange={(v) => setRange({ ...range, from: v })} />
              <DateField label="Hasta (opcional)" value={range.to} min={range.from} onChange={(v) => setRange({ ...range, to: v })} />
              <button type="button" className="btn primary" disabled={!range.from || (!!range.to && range.to < range.from)}
                onClick={() => { void setPlan({ excluir: [...plan.excluir, { from: range.from, to: range.to || range.from }] }); setRange({ from: '', to: '' }); }}>Excluir</button>
            </>}
            {sheet.f === 'orden' && (
              <div className="radios" role="radiogroup" aria-label="Orden" onKeyDown={radioKeys}>
                {ORDENES.map((o) => <button key={o.id} type="button" role="radio" aria-checked={plan.orden === o.id} tabIndex={plan.orden === o.id ? 0 : -1} onClick={() => void setPlan({ orden: o.id })}><span className="r" /><span>{o.label}</span></button>)}
              </div>
            )}
            <button type="button" className="btn" onClick={() => setSheet(null)}>Listo</button>
          </div>
        )}
      </Sheet>
    </>
  );
}
