import { useEffect, useState } from 'react';
import { local } from './local.ts';
import { reconnectDrive } from './sync/auto.ts';
import { connectGoogle, disconnectGoogle, IS_NATIVE, IS_PAGES, loadGoogle, setTargetKind, targetKind } from './sync/google.ts';
import { useSyncStatus } from './SyncBar.tsx';

/** Ajustes › Sincronización con Google Drive (solo en el build de GitHub Pages y con un ID de cliente configurado). */
export function DriveSettings() {
  const s = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const on = targetKind() === 'drive';
  useEffect(() => { if (!IS_NATIVE) void loadGoogle().catch(() => {}); }, []);

  const run = (fn: () => Promise<void>) => { setBusy(true); setError(''); fn().catch((e) => setError(e instanceof Error ? e.message : 'No se pudo conectar.')).finally(() => setBusy(false)); };
  // Conectar = juntar lo de este dispositivo con lo que ya haya en el Drive: se sube todo y gana el cambio más nuevo de cada registro.
  const connect = () => run(async () => {
    await connectGoogle();
    switchTo('drive');
  });
  // El cursor de un destino no sirve en otro: se baja todo de nuevo y se sube todo lo local (se juntan, sin borrar nada).
  const switchTo = (kind: 'drive' | 'local' | 'server') => {
    setTargetKind(kind);
    local().db.setMeta('cursor', '');
    local().db.markAllDirty();
    location.reload();
  };
  const disconnect = () => { disconnectGoogle(); switchTo(IS_PAGES ? 'local' : 'server'); };

  return (
    <section className="card-group">
      <h2>Google Drive</h2>
      <div className="set-row">
        <div className="set-label">
          <b>{on ? 'Conectado a Google Drive' : IS_NATIVE ? 'Sincronizando con Mi servidor' : 'Solo en este dispositivo'}</b>
          <span>{on ? 'Tus datos se sincronizan con una carpeta oculta de tu Drive que solo usa esta app. Nadie más tiene acceso.' : IS_NATIVE ? 'Sincronizá con tu Google Drive en vez de un servidor propio. Se junta lo que ya tenés acá con lo que haya en el Drive.' : 'Conectá tu Google Drive para usar la app en la compu y en el celu con los mismos datos, sin servidor. Se junta lo que ya tenés acá con lo que haya en el Drive.'}</span>
        </div>
        {on
          ? <>{s.needsAuth && <button type="button" className="btn primary" disabled={busy} onClick={() => run(reconnectDrive)}>Reconectar</button>}<button type="button" className="btn" disabled={busy} onClick={disconnect}>Desconectar</button></>
          : <button type="button" className="btn primary" disabled={busy} onClick={connect}>{busy ? 'Conectando…' : 'Conectar Google Drive'}</button>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {on && IS_NATIVE && <p className="muted pad">Para quitar el permiso de la app, entrá a myaccount.google.com/permissions.</p>}
      <p className="muted pad"><a href={`${import.meta.env.BASE_URL}privacidad.html`} target="_blank" rel="noreferrer">Política de privacidad</a></p>
    </section>
  );
}
