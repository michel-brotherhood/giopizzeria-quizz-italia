import { sha256 } from './crypto.js';
import { err } from '../errors.js';

export function validKey(key) {
  return typeof key === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(key);
}

/**
 * Executa fn uma única vez por (scope, key) dentro da transação corrente.
 * Repetição com mesmo payload devolve a resposta armazenada; payload diferente -> conflito.
 * Erros fazem rollback da própria chave (não ficam armazenados).
 */
export async function idempotent(client, scope, key, payload, fn) {
  if (!validKey(key)) throw err('IDEMPOTENCY_KEY_REQUIRED');
  const requestHash = sha256(JSON.stringify(payload ?? null));
  const ins = await client.query(
    `INSERT INTO idempotency_keys (scope, key, request_hash) VALUES ($1,$2,$3)
     ON CONFLICT (scope, key) DO NOTHING RETURNING key`,
    [scope, key, requestHash],
  );
  if (ins.rowCount === 0) {
    const { rows } = await client.query(
      'SELECT request_hash, response FROM idempotency_keys WHERE scope=$1 AND key=$2 FOR UPDATE',
      [scope, key],
    );
    if (rows[0].request_hash !== requestHash) throw err('IDEMPOTENCY_CONFLICT');
    if (rows[0].response) return { ...rows[0].response, replayed: true };
  }
  const result = await fn();
  await client.query('UPDATE idempotency_keys SET status_code=200, response=$3 WHERE scope=$1 AND key=$2', [scope, key, result]);
  return result;
}
