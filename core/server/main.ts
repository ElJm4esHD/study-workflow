import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildApp } from './app.ts';
import { modules } from '../../modules/server.ts';

const dbPath = process.env.DB_PATH ?? './data/study.sqlite';
mkdirSync(dirname(dbPath), { recursive: true });
const app = await buildApp({ dbPath, modules, webDist: process.env.WEB_DIST });
await app.listen({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? '0.0.0.0' });
