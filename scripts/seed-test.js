// Seed de DESENVOLVIMENTO: campanha de teste claramente identificada e operadores de teste.
// Recusa rodar em produção. Senhas geradas aleatoriamente e exibidas só no terminal.
import crypto from 'node:crypto';
import { config } from '../server/config.js';
import { createPool } from '../server/db/pool.js';
import { migrate } from '../server/db/migrate.js';
import { hashPassword } from '../server/services/crypto.js';

if (config.isProd) {
  console.error('seed-test recusado: APP_ENV=production.');
  process.exit(1);
}

export const TEST_REWARD = 'Brinde de exemplo — sem valor de resgate';

export async function seedTest(pool, { stock = 20, passwords = {} } = {}) {
  await migrate(pool, () => {});
  const out = {};
  for (const [username, role, name] of [['gerente.teste', 'manager', 'Gerente (teste)'], ['atendente.teste', 'attendant', 'Atendente (teste)']]) {
    const pw = passwords[username] ?? crypto.randomBytes(9).toString('base64url');
    await pool.query(
      `INSERT INTO operators (username, display_name, role, password_hash) VALUES ($1,$2,$3,$4)
       ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash, active=true`,
      [username, name, role, await hashPassword(pw)]);
    out[username] = pw;
  }
  const { rows: [existing] } = await pool.query(`SELECT id FROM campaigns WHERE is_test AND state <> 'closed' ORDER BY id DESC LIMIT 1`);
  if (!existing) {
    const now = Date.now();
    await pool.query(
      `INSERT INTO campaigns (name, is_test, state, reward_name, quantity_per_voucher, rules_text, starts_at, ends_at, total_stock)
       VALUES ($1, true, 'active', $2, 1, $3, $4, $5, $6)`,
      ['[TESTE] Campanha de desenvolvimento', TEST_REWARD,
        'Campanha de teste local. Não há brinde real; nenhum código emitido aqui pode ser trocado por produto.',
        new Date(now - 3600_000).toISOString(), new Date(now + 30 * 24 * 3600_000).toISOString(), stock]);
  }
  return out;
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool();
  const pw = await seedTest(pool);
  console.log('Campanha [TESTE] ativa (sem valor de resgate). Operadores de teste:');
  for (const [u, p] of Object.entries(pw)) console.log(`  ${u}  senha: ${p}`);
  await pool.end();
}
