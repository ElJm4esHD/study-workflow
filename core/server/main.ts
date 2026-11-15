import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildApp } from './app.ts';

const dbPath = process.env.DB_PATH ?? './data/sync.sqlite';
mkdirSync(dirname(dbPath), { recursive: true });
const app = await buildApp({ dbPath, webDist: process.env.WEB_DIST });
await app.listen({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? '0.0.0.0' });
