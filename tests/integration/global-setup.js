// Sobe um PostgreSQL real e isolado para os testes (porta 54330, diretório .data/pg-test),
// a menos que TEST_DATABASE_URL aponte para outro PostgreSQL de teste.
import { startEmbedded } from '../../scripts/pg-embedded.js';

let server;
export async function setup() {
  if (process.env.TEST_DATABASE_URL) return;
  server = await startEmbedded({ port: 54330, dir: '.data/pg-test', databases: ['gio_itest'] });
  process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:54330/gio_itest';
}
export async function teardown() {
  if (server) await server.stop();
}
