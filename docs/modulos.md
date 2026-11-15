# Módulos

Núcleo chico + módulos. Agregar una funcionalidad = una carpeta en `modules/<id>/` y registrarla en dos listas. No se toca ningún otro módulo.

```
modules/<id>/
  app/index.ts           # AppModule: colecciones, rutas locales, service, búsqueda
  app/*.ts               # lógica (corre en la app, sobre colecciones locales)
  web/index.tsx          # WebModule
```

La lógica y los datos viven **en la app** (web y APK), no en el servidor: el servidor solo guarda y entrega registros de sincronización (ver [sync.md](sync.md)).

## App (`core/app/registry.ts`)

```ts
interface AppModule {
  id: string;                 // 'todo' → rutas locales en /api/todo
  requires?: string[];        // ids de los que depende (se cargan antes)
  collections: string[];      // colecciones propias, con el prefijo del módulo: 'todo_items'
  routes(r: LocalRouter, ctx: AppContext): void;   // se monta con prefijo /api/<id>
  service?(ctx: AppContext): object;               // disponible para otros como ctx.services.get(id)
  search?(ctx: AppContext, q: string): SearchHit[]; // aporta resultados a la búsqueda global (/api/search)
}
type SearchHit = { id: string; kind: string; title: string; detail?: string; to: string };  // `to` = ruta de la app
interface AppContext {
  db: LocalDb; col<T extends { id: string }>(name: string): Collection<T>; transaction<T>(fn: () => T): T;
  materias: MateriasService; settings: SettingsService;
  modules: { isEnabled(id: string): boolean };
  services: { get<T>(id: string): T | undefined };
}
interface Collection<T> { all(): T[]; get(id: string): T | undefined; put(doc: T): void; remove(id: string): void }
```

Reglas:

- Un módulo solo toca colecciones con su prefijo (`todo_*`, `notas_*`). Para datos de otro módulo usa `ctx.services.get<TodoService>('todo')` (tipado con `import type`); las materias se leen solo con `ctx.materias`.
- Cada documento es un objeto JSON con `id` (los mismos objetos camelCase que devuelve la API). Se tratan como **inmutables**: para cambiar uno se arma uno nuevo con `{ ...actual, campo }` y se hace `put`. Lo que antes era una tabla hija (subtareas, excepciones de una serie, ítems de un plan) va **adentro** del documento.
- Sin FK ni cascadas: si el módulo borra algo con hijos, los borra a mano. **Quien lee tolera referencias colgantes** (una materia que no está, un evento borrado): las ignora o las muestra como "sin materia".
- Un `id` determinístico (p. ej. el de la materia) hace que dos dispositivos que crean lo mismo caigan en el mismo registro.
- La validación de entradas va en el service (la ruta puede declarar el tipo de cada campo del cuerpo: `'string!'` obligatorio, `'string?'` admite null, `'any'` sin chequeo). Errores: `httpError(status, code, mensaje)` de `core/shared/errors.ts`.
- Las rutas son síncronas y devuelven datos (o `created(x)` / `noContent()`); lanzar un `HttpError` responde con ese status. Todo lo que sale es una copia.
- Desactivar un módulo lo saca de la UI y de lo que muestran otros, pero sus datos siguen (no se pierden). Desactivar uno del que otro depende desactiva también al dependiente.
- Búsqueda global (`/` o Ctrl+K): el núcleo llama a `search(ctx, q)` de cada módulo activo y junta los resultados. `core/shared/normalize.ts` trae `contains(q, ...textos)` (ignora mayúsculas y tildes). Un módulo sin `search` no aparece.
- Backup (`GET/POST /api/backup`, formato `study-workflow-backup` v2): exporta e importa los registros de **todas** las colecciones declaradas en `collections`; un módulo nuevo entra solo.
- Cambiar la forma de un documento en el futuro: el documento guarda su versión y el módulo la convierte al leer (no hay migraciones SQL).
- Tests: `makeTestApp(modules)` de `core/app/testing.ts` arma la app en memoria; `app.inject({ method, url, payload })` pega a las rutas como siempre.

## Frontend (`core/web/registry.ts`)

```ts
interface WebModule {
  id: string;
  name: string;                          // label de la navegación
  icon: ComponentType;                   // SVG inline
  routes: RouteObject[];                 // react-router, paths absolutos
  nav?: { path: string; order: number }; // ítem de navegación
  settings?: ComponentType;              // panel opcional en Ajustes
  settingsTitle?: string;                // título de esa sección (por defecto, name)
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

Componentes compartidos: `ReminderField` (`core/web/ReminderField.tsx`) es el selector de recordatorio; un módulo que lo use guarda `reminderMin` y `reminderInsistent` en su tabla. `reloadAll()` de `core/web/api.ts` pide recargar a todas las pantallas que usan `useApi`.

Las pantallas piden datos con `api()` de `core/web/api.ts`: se resuelve **dentro de la app** (sin red) contra el router local. Los módulos nunca llaman a `fetch`; la sincronización con el servidor es del núcleo. Todo anda sin conexión, así que no hay acciones bloqueadas.

## Ejemplo mínimo: módulo `notas`

`modules/notas/app/index.ts`

```ts
import type { AppModule } from '../../../core/app/registry.ts';
import { created } from '../../../core/app/router.ts';

type Nota = { id: string; text: string; createdAt: string };

export const notas: AppModule = {
  id: 'notas',
  collections: ['notas_items'],
  routes(r, ctx) {
    const col = ctx.col<Nota>('notas_items');
    r.get('/', () => col.all().sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    r.post('/', { text: 'string!' }, (req) => {
      const doc = { id: crypto.randomUUID(), text: req.body.text, createdAt: new Date().toISOString() };
      col.put(doc);
      return created(doc);
    });
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

- `modules/app.ts`: importar `notas` y agregarlo al array `appModules`.
- `modules/web.ts`: importar `notasModule` y agregarlo al array `webModules`.

Al arrancar, la app monta `/api/notas` sobre la base local y la sincroniza con el servidor sin que este conozca el módulo; el shell agrega "Notas" a la navegación y aparece en Ajustes para activarlo o desactivarlo.

## shareTarget (opcional)

`shareTarget?: string` en el módulo web: ruta que recibe el texto compartido desde el menú Compartir de Android. El núcleo navega a la del primer módulo activo que lo declare; la página toma el texto con `popShared()` (`core/web/shared.ts`). Importar declara `/importar`.
