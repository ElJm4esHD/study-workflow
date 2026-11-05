# Módulos

Núcleo chico + módulos. Agregar una funcionalidad = una carpeta en `modules/<id>/` y registrarla en dos listas. No se toca ningún otro módulo.

```
modules/<id>/
  server/index.ts        # ServerModule
  server/migrations/     # 001_*.sql, 002_*.sql…
  web/index.tsx          # WebModule
```

## Backend (`core/server/registry.ts`)

```ts
interface ServerModule {
  id: string;                 // 'todo' → rutas en /api/todo
  migrationsDir: URL;         // carpeta con las migraciones del módulo
  requires?: string[];        // ids de los que depende (se cargan antes)
  routes(app: FastifyInstance, ctx: CoreContext): Promise<void>;  // se registra con prefix /api/<id>
  service?(ctx: CoreContext): object;  // disponible para otros como ctx.services.get(id)
}
interface CoreContext {
  db: DatabaseSync; transaction<T>(fn: () => T): T;
  materias: MateriasService; settings: SettingsService;
  modules: { isEnabled(id: string): boolean };
  services: { get<T>(id: string): T | undefined };
}
```

Reglas:

- Un módulo solo toca tablas con su prefijo (`todo_*`, `notas_*`). Para datos de otro módulo usa `ctx.services.get<TodoService>('todo')` (tipado con `import type`); las materias se leen solo con `ctx.materias`.
- Sus tablas pueden tener FK a `materias(id)`: las materias nunca se borran, solo se archivan.
- Desactivar un módulo lo saca de la UI y de lo que muestran otros, pero migraciones y API siguen andando (no se pierden datos). Desactivar uno del que otro depende desactiva también al dependiente.
- Auth: `core/server/auth.ts` es un hook `onRequest` que hoy deja pasar todo; ahí se engancha el login.
- DB en `snake_case`, API en `camelCase` (el mapeo va en el service). Errores: `httpError(status, code, mensaje)` de `core/server/errors.ts`.

## Frontend (`core/web/registry.ts`)

```ts
interface WebModule {
  id: string;
  name: string;                          // label de la navegación
  icon: ComponentType;                   // SVG inline
  routes: RouteObject[];                 // react-router, paths absolutos
  nav?: { path: string; order: number }; // ítem de navegación
  settings?: ComponentType;              // panel opcional en Ajustes
  dashboard?: { id: string; order: number; column: 'left' | 'right'; Card: ComponentType }[];  // tarjetas de Inicio
  requires?: string[];
}
```

Inicio (`/`) junta las `dashboard` de los módulos activos: en el celu una sola columna ordenada por `order`, en la compu dos columnas según `column`. La tarjeta usa las clases globales `.card` y `.card-head` (h3 + link). Ejemplo:

```tsx
dashboard: [{ id: 'notas-resumen', order: 40, column: 'right', Card: () => (
  <div className="card"><div className="card-head"><h3>Notas</h3><a href="/notas">Ver</a></div></div>
) }],
```

`prefetch?: () => string[]` declara las URLs GET que el núcleo pide una vez al arrancar con conexión (junto con `/api/materias` y `/api/settings`), para que el APK tenga copia sin red. Ejemplo: `prefetch: () => ['/api/notas']`. Sin conexión solo se pueden tildar tareas: usá `useBlock()` (`core/web/CoreContext.tsx`) en las acciones que escriben, para deshabilitarlas con `aria-disabled` y avisar al tocar.

Todo pedido HTTP pasa por `api()` de `core/web/api.ts`; los módulos nunca llaman a `fetch`.

## Ejemplo mínimo: módulo `notas`

`modules/notas/server/migrations/001_notas.sql`

```sql
CREATE TABLE notas_items (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

`modules/notas/server/index.ts`

```ts
import type { ServerModule } from '../../../core/server/registry.ts';

export const notas: ServerModule = {
  id: 'notas',
  migrationsDir: new URL('./migrations/', import.meta.url),
  async routes(app, ctx) {
    app.get('/', async () =>
      ctx.db.prepare('SELECT id, text, created_at AS createdAt FROM notas_items ORDER BY created_at').all());
  },
};
```

`modules/notas/web/index.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { WebModule } from '../../../core/web/registry.ts';
import { api } from '../../../core/web/api.ts';

type Nota = { id: string; text: string; createdAt: string };

const NotasIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 4h14v16H5zM9 9h6M9 13h6" />
  </svg>
);

function NotasPage() {
  const [notas, setNotas] = useState<Nota[]>([]);
  useEffect(() => { api<Nota[]>('GET', '/api/notas').then(setNotas); }, []);
  return <ul>{notas.map((n) => <li key={n.id}>{n.text}</li>)}</ul>;
}

export const notasModule: WebModule = {
  id: 'notas',
  name: 'Notas',
  icon: NotasIcon,
  nav: { path: '/notas', order: 40 },
  routes: [{ path: '/notas', element: <NotasPage /> }],
};
```

(Una página real debería manejar el error de `api()`, que lanza `ApiError`; `modules/todo/web/` sirve de referencia.)

## Registrarlo

- `modules/server.ts`: importar `notas` y agregarlo al array `modules`.
- `modules/web.ts`: importar `notasModule` y agregarlo al array `webModules`.

Al arrancar, el server corre las migraciones nuevas del módulo y monta `/api/notas`; el shell agrega "Notas" a la navegación y aparece en Ajustes para activarlo o desactivarlo.

## shareTarget (opcional)

`shareTarget?: string` en el módulo web: ruta que recibe el texto compartido desde el menú Compartir de Android. El núcleo navega a la del primer módulo activo que lo declare; la página toma el texto con `popShared()` (`core/web/shared.ts`). Importar declara `/importar`.
