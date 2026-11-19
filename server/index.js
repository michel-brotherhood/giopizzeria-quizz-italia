import { config } from './config.js';
import { createPool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { createApp } from './app.js';
import { startExpiryLoop } from './services/expiry.js';

const pool = createPool();
await migrate(pool);
const app = createApp(pool);
const stop = startExpiryLoop(pool, config.EXPIRY_INTERVAL_SECONDS);
const server = app.listen(config.PORT, () => {
  console.log(`Gio — Da massa ao forno | ${config.APP_ENV} | porta ${config.PORT} | campanhas reais ${config.REAL_CAMPAIGNS_ENABLED ? 'HABILITADAS' : 'bloqueadas'}`);
});

function shutdown() {
  stop();
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
