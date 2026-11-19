// PostgreSQL real (binários oficiais via embedded-postgres) para desenvolvimento e testes locais.
// Não é usado em produção: lá DATABASE_URL aponta para o PostgreSQL da VPS/Dokku.
import EmbeddedPostgres from 'embedded-postgres';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function startEmbedded({ port = 54329, dir = '.data/pg', databases = ['gio_dev', 'gio_test'] } = {}) {
  const databaseDir = path.join(root, dir);
  const fresh = !fs.existsSync(path.join(databaseDir, 'PG_VERSION'));
  const server = new EmbeddedPostgres({ databaseDir, user: 'postgres', password: 'postgres', port, persistent: true, onLog: () => {} });
  if (fresh) await server.initialise();
  await server.start();
  const admin = new pg.Client({ connectionString: `postgres://postgres:postgres@127.0.0.1:${port}/postgres` });
  await admin.connect();
  for (const db of databases) {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [db]);
    if (!rowCount) await admin.query(`CREATE DATABASE ${db}`);
  }
  await admin.end();
  return server;
}
