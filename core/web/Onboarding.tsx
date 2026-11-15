import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { MateriaForm } from './AjustesPage.tsx';
import { useCore } from './CoreContext.tsx';
import { MateriaChip } from './MateriaChip.tsx';
import { DEFAULT_SERVER, getServerUrl, isNative } from './server.ts';

const KEY = 'sw.welcomed';
export const wasWelcomed = (): boolean => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const markWelcomed = () => { try { localStorage.setItem(KEY, '1'); } catch { /* sin storage: se vuelve a mostrar */ } };

/** Guía de primera vez (3 pasos, se puede saltear). Se abre sola si no hay materias, o desde Ajustes › General (`sw:welcome`). */
export function Onboarding() {
  const { materias, enabledModules } = useCore();
  const nav = useNavigate();
  const [open, setOpen] = useState(() => !wasWelcomed() && materias.length === 0);
  const [step, setStep] = useState(0);
  const [adding, setAdding] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const canImport = enabledModules.some((m) => m.id === 'import');
  const steps = canImport ? 3 : 2;

  useEffect(() => {
    const f = () => { setStep(0); setAdding(false); setOpen(true); };
    window.addEventListener('sw:welcome', f);
    return () => window.removeEventListener('sw:welcome', f);
  }, []);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = (to?: string) => { markWelcomed(); setOpen(false); if (to) nav(to); };
  const active = materias.filter((m) => !m.archived);
  const server = isNative() ? (getServerUrl() ?? DEFAULT_SERVER) : location.origin;
  const last = step === steps - 1;

  return (
    <dialog ref={dlg} className="onboarding" aria-labelledby="ob-t" onCancel={(e) => { e.preventDefault(); close(); }}>
      <p className="eyebrow">Paso {step + 1} de {steps}</p>
      {step === 0 && (
        <div className="ob-body">
          <h2 id="ob-t">Bienvenido a Study Workflow</h2>
          <p>Acá organizás la facultad y tu día: tareas, calendario, materias, exámenes y planes de estudio.</p>
          <p>Estás conectado a <b className="ob-url">{server}</b>. {isNative() && 'Si algún día no carga, revisá que Tailscale esté prendido en el celu. Podés cambiar la dirección en Ajustes › Servidor.'}</p>
        </div>
      )}
      {step === 1 && (
        <div className="ob-body">
          <h2 id="ob-t">Tus materias</h2>
          <p>Cada materia tiene un color y una sigla. Las tareas, eventos y exámenes se organizan por materia.</p>
          {active.length > 0 && <ul className="ob-list">{active.map((m) => <li key={m.id}><MateriaChip materia={m} /><span>{m.name}</span></li>)}</ul>}
          {adding
            ? <MateriaForm onDone={() => setAdding(false)} />
            : <button type="button" className="btn" onClick={() => setAdding(true)}>{active.length ? 'Agregar otra materia' : 'Crear una materia'}</button>}
          {!active.length && !adding && <p className="muted">Podés saltear este paso: un plan importado crea las materias que falten.</p>}
        </div>
      )}
      {step === 2 && (
        <div className="ob-body">
          <h2 id="ob-t">Cargar un plan de estudio</h2>
          <ol className="ob-steps">
            <li>En Claude, armá el plan con tu skill <b>cargar-app</b> y copiá el texto que te da.</li>
            <li>En el celu, compartilo a Study Workflow desde el menú “Compartir”, o pegalo en <b>Importar</b>.</li>
            <li>Revisá la vista previa, elegí qué cargar y confirmá.</li>
          </ol>
        </div>
      )}
      <div className="row ob-actions">
        <button type="button" className="btn" onClick={() => close()}>Saltear</button>
        {step > 0 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>Atrás</button>}
        {last
          ? <>{canImport && <button type="button" className="btn" onClick={() => close('/importar')}>Ir a Importar</button>}<button type="button" className="btn primary" onClick={() => close()}>Listo</button></>
          : <button type="button" className="btn primary" onClick={() => setStep(step + 1)}>Siguiente</button>}
      </div>
    </dialog>
  );
}
