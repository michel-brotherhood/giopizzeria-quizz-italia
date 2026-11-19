import { startEmbedded } from './pg-embedded.js';

const port = Number(process.env.PG_PORT || 54329);
const server = await startEmbedded({ port });
console.log(`PostgreSQL local em postgres://postgres:postgres@127.0.0.1:${port}/gio_dev (e gio_test). Ctrl+C para parar.`);
const stop = async () => { await server.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
