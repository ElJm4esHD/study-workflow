import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext } from '@playwright/test';

const SCREENS = [
  ['inicio', '/'], ['todo-hoy', '/todo'], ['todo-proximas', '/todo?vista=proximas'], ['todo-materia', '/todo?vista=materia'], ['todo-completadas', '/todo?vista=completadas'],
  ['todo-nueva', '/todo/nueva'], ['calendario-mes', '/calendario?vista=mes'], ['calendario-semana', '/calendario?vista=semana'], ['evento-nuevo', '/calendario/evento/nuevo'],
  ['finales', '/finales'], ['importar', '/importar'], ['planes', '/importar/planes'], ['ajustes', '/ajustes'], ['novedades', '/ajustes/novedades'],
] as const;
const SIZES = [['412', { width: 412, height: 915 }], ['1440', { width: 1440, height: 900 }]] as const;

async function seed(request: APIRequestContext) {
  const m = await (await request.post('/api/materias', { data: { name: 'Álgebra y Geometría Analítica', color: '#9fc3f7', sigla: 'AGA' } })).json();
  const f = await (await request.post('/api/materias', { data: { name: 'Física', color: '#f4a3a3', sigla: 'FIS' } })).json();
  const today = new Date().toISOString().slice(0, 10);
  await request.post('/api/todo', { data: { title: 'Guía 4: autovalores y autovectores', materiaId: m.id, dueDate: today, dueTime: '09:00', category: 'estudio', durationMin: 90, subtasks: [{ id: crypto.randomUUID(), title: 'Ejercicio 1', done: false }] } });
  await request.post('/api/todo', { data: { title: 'Entrega TP 2', materiaId: f.id, dueDate: today, category: 'entrega' } });
  await request.post('/api/todo', { data: { title: 'Sin fecha', materiaId: null } });
  const plus = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  for (const [id, n] of [[m.id, 20], [m.id, 30], [f.id, 24], [f.id, 34]] as const) await request.post('/api/finals/dates', { data: { materiaId: id, date: plus(n), time: null } });
  await request.post('/api/calendar/events', { data: { title: 'Parcial 1', kind: 'parcial', materiaId: m.id, allDay: false, startDate: today, startTime: '14:00', endDate: today, endTime: null, notes: null, repeatWeekdays: null, repeatUntil: null, reminderMin: null, reminderInsistent: false } });
}

test.beforeAll(async ({ request }) => { await seed(request); });

for (const theme of ['oscuro', 'claro'] as const) for (const [sizeName, viewport] of SIZES) {
  for (const [name, url] of SCREENS) {
    test(`axe ${name} @${sizeName} ${theme}`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('sw.prefs', JSON.stringify({ theme: t })), theme);
      await page.setViewportSize(viewport);
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      const lines = violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')} → ${v.nodes[0]?.failureSummary?.replace(/\s+/g, ' ')}`);
      expect(lines, lines.join('\n')).toEqual([]);
    });
  }
}

test('fecha y hora: se tipean rápido y el calendario es accesible', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/todo/nueva');
  await page.getByLabel('Título').fill('Prueba');
  await page.getByLabel('Fecha', { exact: true }).fill('hoy');
  await page.getByLabel('Hora', { exact: true }).fill('930');
  await page.getByLabel('Hora', { exact: true }).blur();
  await expect(page.getByLabel('Hora', { exact: true })).toHaveValue('09:30');
  await page.getByRole('button', { name: /Elegir en el calendario: fecha/ }).click();
  const dialog = page.getByRole('dialog', { name: /Elegir fecha/ });
  await expect(dialog).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include('dialog.picker').analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('Fecha', { exact: true })).not.toHaveValue('');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/\/todo$/);
});

test('hoja "Más": abre, atrapa el foco y Esc devuelve el foco', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/');
  const more = page.getByRole('button', { name: 'Más' });
  await more.click();
  await expect(page.getByRole('dialog', { name: 'Más' })).toBeVisible();
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('.sheet'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
});

test('búsqueda global: Ctrl+K, resultados accesibles y Enter abre el primero', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle'); // la app tiene que haber arrancado para escuchar el teclado
  await expect(page.getByRole('dialog', { name: 'Buscar' })).toBeHidden(); // cerrado no se ve
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Buscar' });
  await expect(dialog).toBeVisible();
  await page.getByLabel('Buscar tareas y eventos').fill('guia');
  await expect(dialog.getByRole('link', { name: /Guía 4/ }).first()).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include('dialog.search').analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/[/]todo[/][^/]+$/);
});

test('guía de inicio: se abre desde Ajustes, es accesible y se saltea', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/ajustes');
  await page.getByRole('button', { name: 'Ver la guía' }).click();
  const dialog = page.locator('dialog.onboarding');
  await expect(dialog).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include('dialog.onboarding').analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
  await dialog.getByRole('button', { name: 'Siguiente' }).click();
  await expect(dialog.getByRole('heading', { name: 'Tus materias' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Saltear' }).click();
  await expect(dialog).toBeHidden();
});

test('backup: exportar baja un .json y restaurarlo deja los datos igual', async ({ page, request }) => {
  const before = await (await request.get('/api/todo')).json();
  const res = await request.get('/api/backup');
  expect(res.headers()['content-disposition']).toContain('attachment');
  const backup = await res.json();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ajustes');
  await page.locator('input[type=file]').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByRole('dialog', { name: /Reemplazar todo/ })).toBeVisible();
  await page.getByRole('button', { name: 'Reemplazar todo' }).click();
  await expect(page.getByText('Backup restaurado.')).toBeVisible();
  const after = await (await request.get('/api/todo')).json();
  expect(after).toEqual(before);
});
