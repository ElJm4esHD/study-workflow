import { mkdirSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/** Pantallas y estados a 412 y 1440 px. Las fases van en orden: vacío → cargando/error → con datos → casos límite. */
const SIZES = { '412': { width: 412, height: 915 }, '1440': { width: 1440, height: 900 } } as const;
const OUT = 'docs/capturas';
const SCREENS = [
  ['inicio', '/'], ['todo-hoy', '/todo'], ['todo-proximas', '/todo?vista=proximas'], ['todo-sin-fecha', '/todo?vista=sin-fecha'], ['todo-por-materia', '/todo?vista=materia'],
  ['todo-completadas', '/todo?vista=completadas'], ['todo-nueva', '/todo/nueva'], ['calendario-mes', '/calendario?vista=mes'], ['calendario-semana', '/calendario?vista=semana'],
  ['evento-nuevo', '/calendario/evento/nuevo'], ['finales', '/finales'], ['importar', '/importar'], ['planes', '/importar/planes'], ['ajustes', '/ajustes'], ['novedades', '/ajustes/novedades'],
] as const;
const EMPTY = ['inicio', 'todo-hoy', 'todo-proximas', 'todo-completadas', 'calendario-mes', 'calendario-semana', 'finales', 'planes', 'importar'];

const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(d);
const plus = (n: number) => ymd(new Date(Date.now() + n * 86_400_000));

async function shot(page: Page, size: keyof typeof SIZES, name: string, opts: { full?: boolean } = {}) {
  mkdirSync(`${OUT}/${size}`, { recursive: true });
  await page.setViewportSize(SIZES[size]);
  await page.waitForTimeout(700); // asienta animaciones
  await page.screenshot({ path: `${OUT}/${size}/${name}.png`, fullPage: opts.full ?? false, animations: 'disabled' });
}
const open = async (page: Page, url: string, size: keyof typeof SIZES) => { await page.setViewportSize(SIZES[size]); await page.goto(url); await page.waitForLoadState('networkidle'); };
const welcomed = (page: Page) => page.addInitScript(() => localStorage.setItem('sw.welcomed', '1'));

test.describe.configure({ mode: 'serial' });

test('1 · vacío (sin materias ni datos) y primera vez', async ({ page }) => {
  for (const size of ['412', '1440'] as const) {
    await open(page, '/', size);
    await expect(page.locator('dialog.onboarding')).toBeVisible();
    await shot(page, size, '00-primera-vez');
  }
  await welcomed(page);
  for (const size of ['412', '1440'] as const) {
    for (const [name, url] of SCREENS.filter(([n]) => EMPTY.includes(n))) { await open(page, url, size); await shot(page, size, `vacio-${name}`); }
  }
});

test('2 · cargando y con error', async ({ page }) => {
  await welcomed(page);
  for (const size of ['412', '1440'] as const) {
    for (const [name, url] of [['inicio', '/'], ['todo-hoy', '/todo'], ['calendario-mes', '/calendario']] as const) {
      await page.route('**/api/**', async (r) => { await new Promise((ok) => setTimeout(ok, 2500)); await r.continue().catch(() => {}); });
      await page.setViewportSize(SIZES[size]);
      await page.goto(url);
      await page.waitForTimeout(600);
      await shot(page, size, `cargando-${name}`);
      await page.unroute('**/api/**');
      await page.route('**/api/**', (r) => r.abort());
      await page.goto(url);
      await page.waitForTimeout(900);
      await shot(page, size, `error-${name}`);
      await page.unroute('**/api/**');
    }
  }
});

async function seed(request: APIRequestContext) {
  const mk = async (name: string, color: string, sigla: string) => (await (await request.post('/api/materias', { data: { name, color, sigla } })).json()).id as string;
  const m = {
    alg: await mk('Álgebra y Geometría Analítica', '#f4a3a3', 'AGA'), am2: await mk('Análisis Matemático 2', '#9fc3f7', 'AM2'), f1: await mk('Física 1', '#f0d27a', 'F1'),
    md: await mk('Matemática Discreta', '#93dcbf', 'MD'), pi: await mk('Programación Imperativa', '#c7b6f5', 'PI'),
  };
  const todo = (data: object) => request.post('/api/todo', { data });
  await todo({ title: 'Guía 4: autovalores y autovectores', materiaId: m.alg, dueDate: plus(0), dueTime: '09:00', category: 'estudio', durationMin: 90, subtasks: [{ id: 'a', title: 'Ejercicio 1', done: true }, { id: 'b', title: 'Ejercicio 2', done: false }] });
  await todo({ title: 'Entrega TP 2: listas enlazadas', materiaId: m.pi, dueDate: plus(0), dueTime: '23:59', category: 'entrega', durationMin: 120 });
  await todo({ title: 'Resolver P.5.1 a P.5.4', materiaId: m.md, dueDate: plus(0), durationMin: 30 });
  await todo({ title: 'Repasar integrales dobles', materiaId: m.am2, dueDate: plus(0), category: 'estudio', durationMin: 60 });
  await todo({ title: 'Ejercicios de cinemática', materiaId: m.f1, dueDate: plus(-2), durationMin: 45, reminderMin: 15 });
  await todo({ title: 'Leer el apunte de grafos', materiaId: m.md, dueDate: plus(1), durationMin: 30 });
  await todo({ title: 'Informe de laboratorio', materiaId: m.f1, dueDate: plus(3), category: 'entrega', durationMin: 90 });
  await todo({ title: 'Comprar el libro de álgebra', materiaId: null });
  const done = await (await todo({ title: 'Armar el resumen de límites', materiaId: m.am2, dueDate: plus(-1) })).json();
  await request.patch(`/api/todo/${done.id}`, { data: { completed: true } });
  const ev = (data: object) => request.post('/api/calendar/events', { data: { allDay: false, endTime: null, notes: null, repeatWeekdays: null, repeatUntil: null, reminderMin: null, reminderInsistent: false, ...data } });
  await ev({ title: 'Parcial de Matemática Discreta', kind: 'parcial', materiaId: m.md, allDay: true, startDate: plus(6), endDate: plus(6), startTime: null });
  await ev({ title: 'Parcial de Análisis Matemático 2', kind: 'parcial', materiaId: m.am2, allDay: true, startDate: plus(9), endDate: plus(9), startTime: null });
  await ev({ title: 'Clase de consulta', kind: 'evento', materiaId: m.alg, startDate: plus(2), endDate: plus(2), startTime: '18:00', endTime: '19:30' });
  await ev({ title: 'Clase de Física', kind: 'evento', materiaId: m.f1, startDate: plus(-3), endDate: plus(-3), startTime: '08:00', endTime: '10:00', repeatWeekdays: [1, 3], repeatUntil: plus(60) });
  // Fechas posibles de finales (dentro de 2 a 5 semanas) para ver combinaciones.
  const fin = (materiaId: string, n: number, time: string | null = null) => request.post('/api/finals/dates', { data: { materiaId, date: plus(n), time } });
  for (const [id, ns] of [[m.alg, [17, 31]], [m.am2, [19, 26, 33]], [m.f1, [24, 36]], [m.md, [22, 29]]] as const) for (const n of ns) await fin(id, n);
  return m;
}

test('3 · con datos: todas las pantallas', async ({ page, request }) => {
  await seed(request);
  await welcomed(page);
  for (const size of ['412', '1440'] as const) {
    for (const [name, url] of SCREENS) { await open(page, url, size); await shot(page, size, name, { full: true }); }
    // Diálogos y hojas
    await open(page, '/', size);
    await page.keyboard.press('Control+k');
    await page.getByLabel('Buscar tareas y eventos').fill('guia');
    await shot(page, size, 'dialogo-busqueda');
    await page.keyboard.press('Escape');
    await open(page, '/todo/nueva', size);
    await page.getByRole('button', { name: /Elegir en el calendario: fecha/ }).click();
    await shot(page, size, 'dialogo-calendario-propio');
    await page.keyboard.press('Escape');
    if (size === '412') {
      await open(page, '/', size);
      await page.getByRole('button', { name: 'Más' }).click();
      await shot(page, size, 'hoja-mas');
    }
  }
  // Tema claro: las pantallas principales
  await page.addInitScript(() => localStorage.setItem('sw.prefs', JSON.stringify({ theme: 'claro' })));
  for (const size of ['412', '1440'] as const) {
    for (const [name, url] of SCREENS.filter(([n]) => ['inicio', 'todo-hoy', 'calendario-mes', 'calendario-semana', 'finales', 'ajustes'].includes(n))) {
      await open(page, url, size); await shot(page, size, `claro-${name}`, { full: true });
    }
  }
  await page.addInitScript(() => localStorage.setItem('sw.prefs', JSON.stringify({ theme: 'oscuro' })));
  // Para revisar el diseño en pantallas anchas
  for (const [w, h] of [[1024, 768], [2560, 1300]] as const) {
    await page.setViewportSize({ width: w, height: h });
    for (const [name, url] of [['inicio', '/'], ['todo-hoy', '/todo'], ['calendario-mes', '/calendario'], ['ajustes', '/ajustes']] as const) {
      await page.goto(url); await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
      mkdirSync(`${OUT}/${w}`, { recursive: true });
      await page.screenshot({ path: `${OUT}/${w}/${name}.png`, animations: 'disabled' });
    }
  }
});

test('4 · casos límite y rendimiento', async ({ page, request, context }) => {
  const mats = await (await request.get('/api/materias')).json();
  const long = (await (await request.post('/api/materias', { data: { name: 'Introducción a la Teoría de la Computación y los Lenguajes Formales (Electiva)', color: '#c5de8a', sigla: 'ITCLF' } })).json()).id;
  await request.post('/api/todo', { data: { title: 'Un título larguísimo para probar el corte de línea: entregar el informe final del trabajo práctico integrador con todas las secciones pedidas, los anexos, el código fuente comentado y la presentación para la defensa oral', materiaId: long, dueDate: plus(0), category: 'entrega', durationMin: 90 } });
  for (const [i, m] of mats.slice(0, 5).entries()) {
    await request.post('/api/calendar/events', { data: { title: `Final de ${m.name}`, kind: i % 2 ? 'parcial' : 'final', materiaId: m.id, allDay: true, startDate: plus(10), endDate: plus(10), startTime: null, endTime: null, notes: null, repeatWeekdays: null, repeatUntil: null, reminderMin: null, reminderInsistent: false } });
  }
  for (let i = 0; i < 220; i++) await request.post('/api/todo', { data: { title: `Tarea de prueba ${i + 1}: ejercicio ${(i % 12) + 1}`, materiaId: mats[i % mats.length].id, dueDate: plus(i % 5), durationMin: 15 + (i % 4) * 15 } });
  await welcomed(page);
  await page.addInitScript(() => {
    (window as unknown as { __long: number }).__long = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { (window as unknown as { __long: number }).__long += e.duration; })).observe({ entryTypes: ['longtask'] });
  });
  // Celu: CPU 4 veces más lenta que la de esta compu (aproximación)
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  for (const size of ['412', '1440'] as const) {
    await page.setViewportSize(SIZES[size]);
    const t0 = Date.now();
    await page.goto('/todo?vista=proximas');
    await page.locator('.task-row').first().waitFor();
    const ms = Date.now() - t0;
    await page.waitForLoadState('networkidle');
    const lt = await page.evaluate(() => (window as unknown as { __long: number }).__long);
    const rows = await page.locator('.task-row').count();
    console.log(`RENDIMIENTO (CPU x4) ${size}: ${rows} filas, primera fila en ${ms} ms, tareas largas ${Math.round(lt)} ms`);
    await shot(page, size, 'limite-todo-220-tareas');
    await open(page, `/calendario?vista=mes&fecha=${plus(10)}&dia=${plus(10)}`, size);
    await shot(page, size, 'limite-calendario-5-examenes-mismo-dia');
    await open(page, '/ajustes', size);
    await shot(page, size, 'limite-ajustes-materia-nombre-largo', { full: true });
  }
});
