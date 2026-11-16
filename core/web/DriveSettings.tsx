import { useEffect, useState } from 'react';
import { switchTarget } from './Destino.tsx';
import { ServerForm } from './ServerForm.tsx';
import { reconnectDrive } from './sync/auto.ts';
import { connectGoogle, disconnectGoogle, DRIVE_AVAILABLE, IS_NATIVE, loadGoogle, targetKind } from './sync/google.ts';
import { useSyncStatus } from './SyncBar.tsx';

const NOTE = 'Al cambiar de destino, lo que hay en este dispositivo se junta con lo que ya haya en el nuevo (gana el cambio más reciente de cada cosa). No se borra nada, ni acá ni en el destino anterior.';

/** Ajustes › Sincronización: dónde se guardan los datos (Google Drive, Mi servidor en el APK, o solo este dispositivo). */
export function SyncSettings() {
  const s = useSyncStatus();
  const kind = targetKind();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [server, setServer] = useState(false);
  useEffect(() => { if (!IS_NATIVE && DRIVE_AVAILABLE) void loadGoogle().catch(() => {}); }, []);

  const run = (fn: () => Promise<void>) => { setBusy(true); setError(''); fn().catch((e) => setError(e instanceof Error ? e.message : 'No se pudo conectar.')).finally(() => setBusy(false)); };
  const toDrive = () => run(async () => { await connectGoogle(); switchTarget('drive'); });
  const leave = () => { disconnectGoogle(); switchTarget('local'); };

  const title = kind === 'drive' ? 'Google Drive' : kind === 'server' ? 'Mi servidor' : 'Solo este dispositivo';
  const detail = kind === 'drive' ? 'Tus datos se sincronizan con una carpeta oculta de tu Drive que solo usa esta app. Nadie más tiene acceso.' : kind === 'server' ? 'Tus datos se sincronizan con tu servidor.' : 'Los datos quedan solo acá.';
  return (
    <section className="card-group">
      <h2>Sincronización</h2>
      <div className="set-row">
        <div className="set-label"><b>Ahora: {title}</b><span>{detail}</span></div>
        {kind === 'drive' && s.needsAuth && <button type="button" className="btn primary" disabled={busy} onClick={() => run(reconnectDrive)}>Reconectar</button>}
      </div>
      {kind !== 'drive' && DRIVE_AVAILABLE && (
        <div className="set-row">
          <div className="set-label"><b>Usar Google Drive</b><span>Sin servidor propio: tus datos van a tu Drive.</span></div>
          <button type="button" className="btn" disabled={busy} onClick={toDrive}>{busy ? 'Conectando…' : 'Conectar Google Drive'}</button>
        </div>
      )}
      {IS_NATIVE && kind !== 'server' && (
        <div className="set-row">
          <div className="set-label"><b>Usar mi servidor</b><span>La dirección de tu servidor propio.</span></div>
          {server ? <ServerForm onDone={() => switchTarget('server')} /> : <button type="button" className="btn" onClick={() => setServer(true)}>Poner la dirección</button>}
        </div>
      )}
      {IS_NATIVE && kind === 'server' && <div className="set-row"><ServerForm onDone={() => location.reload()} /></div>}
      {kind !== 'local' && (
        <div className="set-row">
          <div className="set-label"><b>Dejar de sincronizar</b><span>Los datos se quedan en este dispositivo.</span></div>
          <button type="button" className="btn" disabled={busy} onClick={leave}>Solo en este dispositivo</button>
        </div>
      )}
      {kind === 'drive' && IS_NATIVE && <p className="muted pad">Para quitar el permiso de la app, entrá a myaccount.google.com/permissions.</p>}
      <p className="muted pad">{NOTE}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted pad"><a href={`${import.meta.env.BASE_URL}privacidad.html`} target="_blank" rel="noreferrer">Política de privacidad</a></p>
    </section>
  );
}
