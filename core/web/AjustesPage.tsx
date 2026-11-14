import { useState, type FormEvent } from 'react';
import { makeSigla } from '../shared/sigla.ts';
import { PALETTE } from '../shared/palette.ts';
import type { Materia } from '../server/registry.ts';
import { webModules } from '../../modules/web.ts';
import { api, ApiError } from './api.ts';
import { BLOCKED, useCore } from './CoreContext.tsx';
import type { WebModule } from './registry.ts';
import { ChevronIcon } from './icons.tsx';
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
      <li key={m.id} className="list-row">
        <span className="mod-name"><MateriaChip materia={m} />{m.name}</span>
        <span className="row">
          <button className="btn" onClick={() => setEditing(m.id)} aria-label={`Editar ${m.name}`}>Editar</button>
          <button className="btn" onClick={() => archive(m)} aria-label={`${m.archived ? 'Desarchivar' : 'Archivar'} ${m.name}`}>
            {m.archived ? 'Desarchivar' : 'Archivar'}
          </button>
        </span>
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
        : <button className="btn primary" onClick={() => setEditing('new')}>Nueva materia</button>}
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

export function AjustesPage() {
  const { enabledModules, connection } = useCore();
  if (connection.offline) return <><h1>Ajustes</h1><p className="muted pad" role="alert">{BLOCKED}</p></>;
  return (
    <>
      <h1>Ajustes</h1>
      <div className="cols">
      <Materias />
      <Modulos />
      {isNative() && <section className="card-group"><h2>Servidor</h2><ServerForm onDone={() => location.reload()} /></section>}
      {enabledModules.flatMap((m) => (m.settings ? [{ id: m.id, name: m.name, Panel: m.settings }] : [])).map(({ id, name, Panel }) => (
        <section key={id} className="card-group"><h2>{name}</h2><Panel /></section>
      ))}
      </div>
    </>
  );
}
