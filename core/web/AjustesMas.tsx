import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, errMsg, reloadAll, useApi } from './api.ts';
import { apiBase, isNative } from './server.ts';
import { BLOCKED, useCore } from './CoreContext.tsx';
import { ChevronRightIcon, GaugeIcon, TypeIcon, VibrateIcon } from './icons.tsx';
import { clearCopies } from './offline.ts';
import { ACCENTS, HOMES, setPref, usePrefs, type Accent, type Home } from './prefs.ts';
import { vibrate } from './haptics.ts';
import { ReminderField, reminderDefaults } from './ReminderField.tsx';
import { ConfirmDialog, radioKeys, Segmented } from './ui.tsx';
import { testReminder } from './widgets.ts';
import { NOVEDADES } from './novedades.ts';

/** Secciones de Ajustes que no pertenecen a un módulo. Las de "este dispositivo" no pasan por el servidor: andan sin conexión. */

const SPEEDS = [['lenta', 'Lenta', 'Para ver cada detalle'], ['normal', 'Normal', 'Recomendada'], ['rapida', 'Rápida', 'Más ágil, mismo recorrido'], ['off', 'Sin animaciones', 'Todo cambia al instante']] as const;

export function General() {
  const { enabledModules } = useCore();
  const prefs = usePrefs();
  const has = (id: string) => id === 'inicio' || enabledModules.some((m) => m.nav?.path === `/${id}`);
  const options = (Object.entries(HOMES) as [Home, string][]).filter(([id]) => has(id));
  return (
    <section className="card-group">
      <h2>General</h2>
      <div className="card set-card">
        <div className="set-row">
          <div className="set-label"><b>Pantalla de inicio</b><span>La que se abre al entrar a la app (en este dispositivo).</span></div>
          <Segmented name="home" label="Pantalla de inicio" value={has(prefs.home) ? prefs.home : 'inicio'} options={options} onChange={(v) => setPref('home', v)} />
        </div>
        <div className="set-row">
          <div className="set-label"><b>Guía de inicio</b><span>Conectar el servidor, crear materias y cargar un plan.</span></div>
          <button type="button" className="btn" onClick={() => window.dispatchEvent(new Event('sw:welcome'))}>Ver la guía</button>
        </div>
      </div>
    </section>
  );
}

export function Apariencia() {
  const prefs = usePrefs();
  return (
    <section className="card-group">
      <h2>Apariencia</h2>
      <div className="card set-card">
        <div className="set-row">
          <div className="set-label"><b><TypeIcon size={18} />Tamaño de letra</b><span>Cambia el texto de toda la app; los botones mantienen su tamaño táctil.</span></div>
          <Segmented name="font" label="Tamaño de letra" value={prefs.font} options={[['chica', 'Chica'], ['normal', 'Normal'], ['grande', 'Grande']]} onChange={(v) => setPref('font', v)} />
          <div className="preview">Guía 4: autovalores y autovectores<small>Álgebra · Estudio · 09:00</small></div>
        </div>
        <div className="set-row">
          <div className="set-label"><b>Color de acento</b><span>Botones, selecciones y el foco.</span></div>
          <div className="swatches" role="radiogroup" aria-label="Color de acento" onKeyDown={radioKeys}>
            {(Object.entries(ACCENTS) as [Accent, { label: string; hex: string }][]).map(([id, a]) => (
              <button key={id} type="button" role="radio" aria-checked={prefs.accent === id} aria-label={a.label} tabIndex={prefs.accent === id ? 0 : -1}
                className="swatch" style={{ background: a.hex }} onClick={() => setPref('accent', id)} />
            ))}
          </div>
        </div>
        <div className="set-row">
          <div className="set-label"><b><GaugeIcon size={18} />Velocidad de animaciones</b><span>Si el sistema pide reducir el movimiento, arranca en “Sin animaciones”; desde acá podés cambiarlo.</span></div>
          <div className="radios" role="radiogroup" aria-label="Velocidad de animaciones" onKeyDown={radioKeys}>
            {SPEEDS.map(([v, label, hint]) => (
              <button key={v} type="button" role="radio" aria-checked={prefs.speed === v} tabIndex={prefs.speed === v ? 0 : -1} onClick={() => { setPref('speed', v); vibrate('tick'); }}>
                <span className="r" /><span>{label}<small>{hint}</small></span>
              </button>
            ))}
          </div>
        </div>
        {isNative() && (
          <div className="set-row">
            <div className="set-label"><b><VibrateIcon size={18} />Intensidad de la vibración</b><span>Al tildar, completar, borrar, soltar al reordenar y al refrescar.</span></div>
            <Segmented name="vibration" label="Intensidad de la vibración" value={prefs.vibration}
              options={[['off', 'Apagada'], ['suave', 'Suave'], ['media', 'Media'], ['fuerte', 'Fuerte']]}
              onChange={(v) => { setPref('vibration', v); vibrate('success'); }} />
          </div>
        )}
      </div>
    </section>
  );
}

export function Recordatorios() {
  const { settings, patchSettings, notify } = useCore();
  const d = reminderDefaults(settings);
  return (
    <section className="card-group">
      <h2>Recordatorios</h2>
      <div className="card set-card">
        <div className="set-row">
          <div className="set-label"><b>Con cuánta anticipación</b><span>Es lo que traen por defecto las tareas y eventos nuevos con fecha; lo podés cambiar en cada uno.</span></div>
          <ReminderField value={d.min} insistent={d.insistent}
            onChange={(min, insistent) => void patchSettings({ 'reminder.defaultMin': min, 'reminder.defaultInsistent': insistent }).catch((e) => notify(errMsg(e)))} />
        </div>
        {isNative() && (
          <div className="set-row">
            <div className="set-label"><b>Probar el sonido</b><span>Muestra un recordatorio ahora, con el sonido de alarmas y {d.insistent ? 'en modo insistente (bajá la notificación para pararlo)' : 'una sola vez'}.</span></div>
            <button type="button" className="btn" onClick={() => testReminder(d.insistent)}>Probar sonido</button>
          </div>
        )}
      </div>
    </section>
  );
}

type Pending = { text: string; resumen: string } | null;

export function Datos() {
  const { connection, notify } = useCore();
  const off = connection.offline;
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function pick(f: File | undefined) {
    if (!f) return;
    try {
      const text = await f.text();
      const j = JSON.parse(text) as { format?: string; exportedAt?: string; tables?: Record<string, unknown[]> };
      if (j.format !== 'study-workflow-backup' || !j.tables) throw new Error();
      const n = (t: string) => j.tables![t]?.length ?? 0;
      setPending({ text, resumen: `${n('materias')} materias, ${n('todo_items')} tareas y ${n('calendar_events')} eventos, guardados el ${j.exportedAt ? new Date(j.exportedAt).toLocaleDateString('es-AR') : 'día desconocido'}.` });
    } catch {
      notify('Ese archivo no es un backup de Study Workflow. Elegí el .json que bajaste de Exportar.');
    }
    if (file.current) file.current.value = '';
  }
  async function restore() {
    if (!pending) return;
    setBusy(true);
    try {
      await api('POST', '/api/backup', JSON.parse(pending.text));
      setPending(null);
      notify('Backup restaurado.');
      reloadAll();
      setTimeout(() => location.reload(), 600); // materias y ajustes se leen una vez al arrancar
    } catch (e) { setPending(null); notify(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <section className="card-group">
      <h2>Datos</h2>
      <div className="card set-card">
        <div className="set-row">
          <div className="set-label"><b>Exportar todo</b><span>Baja un archivo .json con tus materias, tareas, eventos, finales y ajustes del servidor.</span></div>
          <a className="btn" href={`${apiBase()}/api/backup`} download target="_blank" rel="noreferrer" aria-disabled={off} onClick={(e) => { if (off) { e.preventDefault(); notify(BLOCKED); } }}>Exportar backup</a>
        </div>
        <div className="set-row">
          <div className="set-label"><b>Importar un backup</b><span>Reemplaza todo lo que hay en el servidor por el contenido del archivo. Antes se guarda una copia en el servidor.</span></div>
          <input ref={file} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files?.[0])} />
          <button type="button" className="btn" aria-disabled={off} onClick={() => { if (off) notify(BLOCKED); else file.current?.click(); }}>Elegir archivo…</button>
        </div>
        {isNative() && (
          <div className="set-row">
            <div className="set-label"><b>Vaciar la copia offline</b><span>Borra lo que el celu guardó para usar sin conexión. Se vuelve a bajar la próxima vez que haya red.</span></div>
            <button type="button" className="btn danger" onClick={() => setClearing(true)}>Vaciar copia</button>
          </div>
        )}
      </div>
      <ConfirmDialog open={!!pending} title="¿Reemplazar todo con este backup?" confirmLabel="Reemplazar todo" busy={busy} onCancel={() => setPending(null)} onConfirm={() => void restore()}>
        <p>El archivo tiene {pending?.resumen}</p>
        <p>Lo que hay ahora en el servidor se reemplaza. No se puede deshacer desde la app (queda una copia de seguridad en el servidor).</p>
      </ConfirmDialog>
      <ConfirmDialog open={clearing} title="¿Vaciar la copia offline?" confirmLabel="Vaciar" onCancel={() => setClearing(false)}
        onConfirm={() => { clearCopies(); setClearing(false); notify('Copia offline vaciada.'); }}>
        <p>Sin conexión no vas a ver tus pantallas hasta que la app vuelva a bajar los datos.</p>
      </ConfirmDialog>
    </section>
  );
}

export function AcercaDe() {
  const { data } = useApi<{ version?: string }>('/api/health');
  return (
    <section className="card-group">
      <h2>Acerca de</h2>
      <div className="card set-card">
        <dl className="about">
          <div><dt>App</dt><dd>Versión {__APP_VERSION__}{NOVEDADES[0]?.version === __APP_VERSION__ ? ` · ${NOVEDADES[0].fecha}` : ''}</dd></div>
          <div><dt>Servidor</dt><dd>{data?.version ? `Versión ${data.version}` : '…'}</dd></div>
        </dl>
        <Link to="/ajustes/novedades" className="set-link"><span><b>Novedades</b><small>{NOVEDADES[0]?.titulo}</small></span><ChevronRightIcon size={18} /></Link>
      </div>
    </section>
  );
}
