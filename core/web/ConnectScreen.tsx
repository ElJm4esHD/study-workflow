import { useState, type FormEvent } from 'react';
import { DEFAULT_SERVER, getServerUrl, normalizeServerUrl, setServerUrl, testServer } from './server.ts';

const FAIL = 'No se pudo conectar con el servidor. Revisá que Tailscale esté prendido y que la dirección sea correcta.';

/** Campo + botón para probar y guardar la URL; lo usan la pantalla inicial y Ajustes. */
export function ServerForm({ onDone }: { onDone(): void }) {
  const [url, setUrl] = useState(getServerUrl() ?? DEFAULT_SERVER);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const clean = normalizeServerUrl(url);
    if (clean && await testServer(clean)) { setServerUrl(clean); onDone(); return; }
    setError(FAIL); setBusy(false);
  }
  return (
    <form className="card form" onSubmit={submit}>
      <label>URL del servidor
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tu-server.tu-tailnet.ts.net:PUERTO" required />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary" disabled={busy}>{busy ? 'Probando…' : 'Probar y guardar'}</button>
    </form>
  );
}

export function ConnectScreen({ onDone }: { onDone(): void }) {
  return <main className="shell"><h1>Conectar con tu servidor</h1><ServerForm onDone={onDone} /></main>;
}
