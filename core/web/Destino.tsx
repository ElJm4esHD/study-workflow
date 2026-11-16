import { useEffect, useState } from 'react';
import { ServerForm } from './ServerForm.tsx';
import { DEFAULT_SERVER, getServerUrl } from './server.ts';
import { connectGoogle, DRIVE_AVAILABLE, IS_NATIVE, IS_PAGES, loadGoogle, setTargetKind, targetChosen, type TargetKind } from './sync/google.ts';
import { local } from './local.ts';

/** ¿Hay que preguntar dónde se guardan los datos? Solo en la web pública y en el APK sin servidor precargado ni guardado. */
export const needsDestino = (): boolean => !targetChosen() && (IS_PAGES || (IS_NATIVE && !getServerUrl() && !DEFAULT_SERVER));

/** Cambia el destino: el cursor de uno no sirve en otro, así que se baja todo de nuevo y se sube todo lo local (se juntan, sin borrar nada). */
export function switchTarget(kind: TargetKind): void {
  setTargetKind(kind);
  local().db.setMeta('cursor', '');
  local().db.markAllDirty();
  location.reload();
}

/** Primera apertura: elegir dónde se guardan los datos. Se puede cambiar después en Ajustes › Sincronización. */
export function Destino() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [server, setServer] = useState(false);
  useEffect(() => { if (!IS_NATIVE && DRIVE_AVAILABLE) void loadGoogle().catch(() => {}); }, []);
  const drive = () => {
    setBusy(true); setError('');
    connectGoogle().then(() => switchTarget('drive'), (e) => { setError(e instanceof Error ? e.message : 'No se pudo conectar con Google.'); setBusy(false); });
  };

  return (
    <main className="center-screen destino" aria-labelledby="dest-t">
      <h1 id="dest-t">¿Dónde guardamos tus datos?</h1>
      <p className="muted">Los datos siempre están en este dispositivo y la app anda sin conexión. Elegí si querés además sincronizarlos para usar la app en otros dispositivos. Lo podés cambiar después en Ajustes.</p>
      <div className="destino-opts">
        {DRIVE_AVAILABLE && (
          <section className="card">
            <h2>Google Drive <span className="chip">Recomendado</span></h2>
            <p className="muted">Sincroniza con una carpeta oculta de tu propio Drive, sin servidor. Nadie más tiene acceso, ni quien hizo la app.</p>
            <button type="button" className="btn primary" disabled={busy} onClick={drive}>{busy ? 'Conectando…' : 'Conectar Google Drive'}</button>
          </section>
        )}
        {IS_NATIVE && (
          <section className="card">
            <h2>Mi servidor</h2>
            <p className="muted">Si tenés tu propio servidor con la app instalada (ver el README).</p>
            {server ? <ServerForm onDone={() => switchTarget('server')} /> : <button type="button" className="btn" onClick={() => setServer(true)}>Poner la dirección</button>}
          </section>
        )}
        <section className="card">
          <h2>Solo este dispositivo</h2>
          <p className="muted">Nada se sincroniza. Podés exportar un backup desde Ajustes › Datos.</p>
          <button type="button" className="btn" disabled={busy} onClick={() => switchTarget('local')}>Usar solo en este dispositivo</button>
        </section>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted"><a href={`${import.meta.env.BASE_URL}privacidad.html`} target="_blank" rel="noreferrer">Política de privacidad</a></p>
    </main>
  );
}
