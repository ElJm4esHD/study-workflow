import { useState, type FormEvent } from 'react';
import { makeSigla } from '../shared/sigla.ts';
import { PALETTE } from '../shared/palette.ts';
import type { Materia } from '../server/registry.ts';
import { webModules } from '../../modules/web.ts';
import { api, ApiError } from './api.ts';
import { BLOCKED, useCore } from './CoreContext.tsx';
import type { WebModule } from './registry.ts';
import { ArchiveIcon, ChevronIcon, ChevronRightIcon, GaugeIcon, PlusIcon, TypeIcon, UnarchiveIcon, VibrateIcon } from './icons.tsx';
import { setPref, usePrefs } from './prefs.ts';
import { vibrate } from './haptics.ts';
import { PageHeader, Segmented } from './ui.tsx';
import { ServerForm } from './ConnectScreen.tsx';
import { isNative } from './server.ts';
import { MateriaChip } from './MateriaChip.tsx';

const msg = (err: unknown) => (err instanceof ApiError ? err.message : 'Algo salió mal.');

function Swatches({ value, onChange }: { value: string; onChange(hex: string): void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Color">
      {PALETTE.map((p) => (
        <button type="button" key={p.hex} role="radio" aria-checked={value === p.hex} aria-label={p.name}
          className="swatch" style={{ background: p.hex }} onClick={() => onChange(p.hex)} />
      ))}
    </div>
  );
}

function MateriaForm({ initial, onDone }: { initial?: Materia; onDone(): void }) {
  const { reloadMaterias, notify } = useCore();
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? PALETTE[7].hex);
  const [sigla, setSigla] = useState(initial?.sigla ?? '');
  const [siglaTouched, setSiglaTouched] = useState(!!initial);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (initial) await api('PATCH', `/api/materias/${initial.id}`, { name, color, sigla });
      else await api('POST', '/api/materias', { name, color, sigla });
      reloadMaterias();
      notify(initial ? 'Materia guardada.' : 'Materia creada.');
      onDone();
    } catch (err) {
      setError(msg(err));
    }
  }
  return (
    <form className="card form" onSubmit={submit}>
      <label>Nombre
        <input value={name} onChange={(e) => { setName(e.target.value); if (!siglaTouched) setSigla(makeSigla(e.target.value)); }} maxLength={60} required autoFocus />
      </label>
      <label>Sigla
        <input value={sigla} onChange={(e) => { setSigla(e.target.value.toUpperCase()); setSiglaTouched(true); }} maxLength={5} />
      </label>
      <Swatches value={color} onChange={setColor} />
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="button" className="btn" onClick={onDone}>Cancelar</button>
        <button className="btn primary">Guardar</button>
      </div>
    </form>
  );
}

function Materias() {
  const { materias, reloadMaterias, notify } = useCore();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const active = materias.filter((m) => !m.archived);
  const archived = materias.filter((m) => m.archived);
  async function archive(m: Materia) {
    try {
      await api('PATCH', `/api/materias/${m.id}`, { archived: !m.archived });
      reloadMaterias();
      notify(m.archived ? 'Materia desarchivada.' : 'Materia archivada.');
    } catch (err) {
      notify(msg(err));
    }
  }
  const row = (m: Materia) => editing === m.id
    ? <li key={m.id}><MateriaForm initial={m} onDone={() => setEditing(null)} /></li>
    : (
      <li key={m.id} className="mat-row">
        <button type="button" className="mat-edit" onClick={() => setEditing(m.id)} aria-label={`Editar ${m.name}`}>
          <MateriaChip materia={m} /><span>{m.name}</span><ChevronRightIcon size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={() => archive(m)} aria-label={`${m.archived ? 'Desarchivar' : 'Archivar'} ${m.name}`} title={m.archived ? 'Desarchivar' : 'Archivar'}>
          {m.archived ? <UnarchiveIcon size={20} /> : <ArchiveIcon size={20} />}
        </button>
      </li>
    );
  return (
    <section className="card-group">
      <h2>Materias</h2>
      <ul className="list">
        {active.map(row)}
        {!active.length && <li className="muted pad">Todavía no creaste ninguna materia.</li>}
      </ul>
      {editing === 'new'
        ? <MateriaForm onDone={() => setEditing(null)} />
        : <button className="btn" onClick={() => setEditing('new')}><PlusIcon size={18} />Nueva materia</button>}
      {archived.length > 0 && (
        <details className="archived">
          <summary><ChevronIcon /> Archivadas ({archived.length})</summary>
          <ul className="list">{archived.map(row)}</ul>
        </details>
      )}
    </section>
  );
}

function Modulos() {
  const { enabledModules, settings, patchSettings, notify } = useCore();
  const on = new Set(enabledModules.map((m) => m.id));
  async function toggle(id: string) {
    const next = new Set(on);
    const dependents: WebModule[] = [];
    if (on.has(id)) {
      next.delete(id);
      // Apaga en cascada a los que dependen (directa o indirectamente) del desactivado.
      for (let grew = true; grew;) {
        grew = false;
        for (const m of webModules) {
          if (next.has(m.id) && m.requires?.some((r) => webModules.some((x) => x.id === r) && !next.has(r))) {
            next.delete(m.id); dependents.push(m); grew = true;
          }
        }
      }
    } else {
      next.add(id);
    }
    const flags = { ...(settings['modules.enabled'] as object | undefined), ...Object.fromEntries(webModules.map((m) => [m.id, next.has(m.id)])) };
    try {
      await patchSettings({ 'modules.enabled': flags });
      if (dependents.length) notify(`También se desactiva ${dependents.map((m) => m.name).join(', ')}.`);
    } catch (err) {
      notify(msg(err));
    }
  }
  return (
    <section className="card-group">
      <h2>Módulos</h2>
      <ul className="list">
        {webModules.map((m) => (
          <li key={m.id} className="list-row">
            <span className="mod-name"><m.icon /> {m.name}</span>
            <label className="switch">
              <input type="checkbox" role="switch" checked={on.has(m.id)} onChange={() => toggle(m.id)} aria-label={m.name} />
              <span className="track" aria-hidden="true" />
            </label>
          </li>
        ))}
        {!webModules.length && <li className="muted pad">No hay módulos instalados.</li>}
      </ul>
    </section>
  );
}

const SPEEDS = [['lenta', 'Lenta', 'Para ver cada detalle'], ['normal', 'Normal', 'Recomendada'], ['rapida', 'Rápida', 'Más ágil, mismo recorrido'], ['off', 'Sin animaciones', 'Todo cambia al instante']] as const;

/** Ajustes de este dispositivo: no pasan por el servidor, así que funcionan también sin conexión. */
function Dispositivo() {
  const prefs = usePrefs();
  return (
    <>
      <section className="card-group">
        <h2>Movimiento{isNative() ? ' y vibración' : ''}</h2>
        <div className="card set-card">
          <div className="set-row">
            <div className="set-label"><b><GaugeIcon size={18} />Velocidad de animaciones</b><span>Si el sistema tiene “Reducir movimiento” activado, arranca en “Sin animaciones”.</span></div>
            <div className="radios" role="radiogroup" aria-label="Velocidad de animaciones">
              {SPEEDS.map(([v, label, hint]) => (
                <button key={v} type="button" role="radio" aria-checked={prefs.speed === v} onClick={() => { setPref('speed', v); vibrate('tick'); }}>
                  <span className="r" /><span>{label}<small>{hint}</small></span>
                </button>
              ))}
            </div>
          </div>
          {isNative() && (
            <div className="set-row">
              <div className="set-label"><b><VibrateIcon size={18} />Vibración</b><span>Al tildar, completar, borrar, soltar al reordenar y al refrescar.</span></div>
              <Segmented name="vibration" label="Vibración" value={prefs.vibration}
                options={[['off', 'Apagada'], ['suave', 'Suave'], ['media', 'Media'], ['fuerte', 'Fuerte']]}
                onChange={(v) => { setPref('vibration', v); vibrate('success'); }} />
            </div>
          )}
        </div>
      </section>
      <section className="card-group">
        <h2>Texto</h2>
        <div className="card set-card">
          <div className="set-row">
            <div className="set-label"><b><TypeIcon size={18} />Tamaño de letra</b><span>Cambia el texto de toda la app; los botones mantienen su tamaño táctil.</span></div>
            <Segmented name="font" label="Tamaño de letra" value={prefs.font} options={[['chica', 'Chica'], ['normal', 'Normal'], ['grande', 'Grande']]} onChange={(v) => setPref('font', v)} />
            <div className="preview">Guía 4: autovalores y autovectores<small>Álgebra · Estudio · 09:00</small></div>
          </div>
        </div>
      </section>
    </>
  );
}

export function AjustesPage() {
  const { enabledModules, connection } = useCore();
  if (connection.offline) return <><PageHeader title="Ajustes" /><p className="muted pad" role="alert">{BLOCKED}</p><div className="cols"><Dispositivo /></div></>;
  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="cols">
      <Materias />
      <Modulos />
      <Dispositivo />
      {isNative() && <section className="card-group"><h2>Servidor</h2><ServerForm onDone={() => location.reload()} /></section>}
      {enabledModules.flatMap((m) => (m.settings ? [{ id: m.id, name: m.name, Panel: m.settings }] : [])).map(({ id, name, Panel }) => (
        <section key={id} className="card-group"><h2>{name}</h2><Panel /></section>
      ))}
      </div>
    </>
  );
}
