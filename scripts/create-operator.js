// Cria/atualiza operador da equipe. Uso:
//   npm run staff:create -- --user maria --name "Maria" --role attendant
// A senha é lida de STAFF_PASSWORD ou digitada (não ecoa no terminal). Nunca embutir senha no front.
import readline from 'node:readline';
import { createPool } from '../server/db/pool.js';
import { migrate } from '../server/db/migrate.js';
import { hashPassword } from '../server/services/crypto.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const user = String(args.user || '').trim().toLowerCase();
const role = args.role || 'attendant';
if (!/^[a-z0-9._-]{3,40}$/.test(user) || !['manager', 'attendant'].includes(role)) {
  console.error('Uso: --user <login> --name "<nome>" --role manager|attendant');
  process.exit(1);
}

async function askHidden(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); };
  return new Promise((res) => rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); res(a); }));
}

const pw = process.env.STAFF_PASSWORD || await askHidden('Senha (mín. 10 caracteres): ');
if (pw.length < 10) { console.error('Senha curta.'); process.exit(1); }
const pool = createPool();
await migrate(pool, () => {});
await pool.query(
  `INSERT INTO operators (username, display_name, role, password_hash) VALUES ($1,$2,$3,$4)
   ON CONFLICT (username) DO UPDATE SET display_name=EXCLUDED.display_name, role=EXCLUDED.role, password_hash=EXCLUDED.password_hash, active=true`,
  [user, args.name || user, role, await hashPassword(pw)]);
console.log(`Operador ${user} (${role}) salvo.`);
await pool.end();
