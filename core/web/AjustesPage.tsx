import { useState, type FormEvent } from 'react';
import { makeSigla } from '../shared/sigla.ts';
import { PALETTE } from '../shared/palette.ts';
import type { Materia } from '../app/registry.ts';
import { webModules } from '../../modules/web.ts';
import { api, errMsg } from './api.ts';
import { useCore } from './CoreContext.tsx';
import type { WebModule } from './registry.ts';
import { ArchiveIcon, ChevronIcon, ChevronRightIcon, PlusIcon, UnarchiveIcon } from './icons.tsx';
import { PageHeader, radioKeys } from './ui.tsx';
import { AcercaDe, Apariencia, Datos, General, Recordatorios } from './AjustesMas.tsx';
import { useSubmit } from './useSubmit.ts';
import { ServerForm } from './ServerForm.tsx';
import { DriveSettings } from './DriveSettings.tsx';
import { GOOGLE_CLIENT_ID, IS_PAGES } from './sync/google.ts';
import { isNative } from './server.ts';
import { MateriaChip } from './MateriaChip.tsx';


function Swatches({ value, onChange }: { value: string; onChange(hex: string): void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Color" onKeyDown={radioKeys}>
      {PALETTE.map((p) => (
        <button type="button" key={p.hex} role="radio" aria-checked={value === p.hex} aria-label={p.name} tabIndex={value === p.hex ? 0 : -1}
          className="swatch" style={{ background: p.hex }} onClick={() => onChange(p.hex)} />
      ))}
    </div>
  );
}

export function MateriaForm({ initial, onDone }: { initial?: Materia; onDone(): void }) {
  const { reloadMaterias, notify } = useCore();
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? PALETTE[7].hex);
  const [sigla, setSigla] = useState(initial?.sigla ?? '');
  const [siglaTouched, setSiglaTouched] = useState(!!initial);
  const sub = useSubmit();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { sub.fail('Escribí el nombre de la materia.'); return; }
    const ok = await sub.run(() => (initial ? api('PATCH', `/api/materias/${initial.id}`, { name: name.trim(), color, sigla }) : api('POST', '/api/materias', { name: name.trim(), color, sigla })));
    if (!ok) return;
    reloadMaterias();
    notify(initial ? 'Materia guardada.' : 'Materia creada.');
    onDone();
  }
  return (
    <form className="card form" onSubmit={submit} noValidate>
      <label>Nombre
        <input value={name} onChange={(e) => { setName(e.target.value); if (!siglaTouched) setSigla(makeSigla(e.target.value)); }} maxLength={60} required autoFocus />
      </label>
      <label>Sigla
        <input value={sigla} onChange={(e) => { setSigla(e.target.value.toUpperCase()); setSiglaTouched(true); }} maxLength={5} />
      </label>
      <Swatches value={color} onChange={setColor} />
      {sub.error && <p className="error" role="alert">{sub.error}</p>}
      <div className="row">
        <button type="button" className="btn" onClick={onDone}>Cancelar</button>
        <button className="btn primary" disabled={sub.saving}>{sub.saving ? 'Guardando…' : 'Guardar'}</button>
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
      notify(errMsg(err));
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
      notify(errMsg(err));
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
  const { enabledModules } = useCore();
  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="cols">
      <General />
      <Materias />
      <Modulos />
      {enabledModules.flatMap((m) => (m.settings ? [{ id: m.id, name: m.settingsTitle ?? m.name, Panel: m.settings }] : [])).map(({ id, name, Panel }) => (
        <section key={id} className="card-group"><h2>{name}</h2><Panel /></section>
      ))}
      <Recordatorios />
      <Apariencia />
      <Datos />
      {IS_PAGES && GOOGLE_CLIENT_ID && <DriveSettings />}
      {isNative() && <section className="card-group"><h2>Servidor</h2><ServerForm onDone={() => location.reload()} /></section>}
      <AcercaDe />
      </div>
    </>
  );
}
