import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../core/web/App.tsx';
import '../core/web/styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
