import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../core/web/App.tsx';
import '../core/web/styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Solo en GitHub Pages: se puede instalar y abrir sin conexión (el server propio ya sirve la app).
if (__PAGES__ && 'serviceWorker' in navigator) void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
