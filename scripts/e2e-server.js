// Servidor para E2E: PostgreSQL isolado (porta 54331) + app servindo o build de produção (dist/) na porta 3100.
// Banco é recriado a cada execução. Campanha de TESTE e operadores com senha de teste conhecida (só E2E).
process.env.APP_ENV = 'test';
process.env.PORT = '3100';
process.env.PUBLIC_BASE_URL = 'http://localhost:3100';
process.env.SERVE_STATIC = 'true';
process.env.COOKIE_SECURE = 'false';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EXPIRY_INTERVAL_SECONDS = '2';
process.env.SESSION_SECRET = 'e2e-secret-0123456789abcdef0123456789';
process.env.DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:54331/gio_e2e';

const { startEmbedded } = await import('./pg-embedded.js');
const pgServer = await startEmbedded({ port: 54331, dir: '.data/pg-e2e', databases: ['gio_e2e'] });
const { createPool } = await import('../server/db/pool.js');
const { migrate } = await import('../server/db/migrate.js');
const { createApp } = await import('../server/app.js');
const { startExpiryLoop } = await import('../server/services/expiry.js');
const { seedTest } = await import('./seed-test.js');

const pool = createPool();
await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await migrate(pool, () => {});
await seedTest(pool, { stock: 50, passwords: { 'gerente.teste': 'e2e-gerente-senha', 'atendente.teste': 'e2e-atendente-senha' } });
const app = createApp(pool, { log: () => {}, serveStatic: true });
startExpiryLoop(pool, 2, () => {});
const server = app.listen(3100, () => console.log('e2e server on http://localhost:3100'));

async function stop() {
  server.close();
  await pool.end();
  await pgServer.stop();
  process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
