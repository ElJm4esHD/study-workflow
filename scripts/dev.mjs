import { spawn } from 'node:child_process';

const procs = ['npm run dev:server', 'npx vite'].map((c) => spawn(c, { shell: true, stdio: 'inherit' }));
// Con shell:true en Windows kill() deja huérfano al hijo; taskkill /t mata el árbol.
const kill = (p) => (process.platform === 'win32' ? spawn(`taskkill /pid ${p.pid} /t /f`, { shell: true }) : p.kill());
const exit = () => { procs.forEach(kill); setTimeout(() => process.exit(), 300); };
process.on('SIGINT', exit);
process.on('SIGTERM', exit);
for (const p of procs) p.on('exit', exit);
