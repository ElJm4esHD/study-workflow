import type { AppModule } from '../core/app/registry.ts';
import { todo } from './todo/app/index.ts';
import { calendar } from './calendar/app/index.ts';
import { importModule } from './import/app/index.ts';
import { finals } from './finals/app/index.ts';

/** Módulos que corren dentro de la app (lógica y datos). Agregar uno = su carpeta `modules/<id>/app` + una línea acá. */
export const appModules: AppModule[] = [todo, calendar, importModule, finals];
