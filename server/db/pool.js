import pg from 'pg';
import { config } from '../config.js';

// bigint (int8) como Number: ids/contadores cabem com folga.
pg.types.setTypeParser(20, (v) => Number(v));

export function createPool(url = config.DATABASE_URL, max = 10) {
  return new pg.Pool({ connectionString: url, max });
}

/** Erro que deve ser lançado ao cliente APÓS confirmar a transação (ex.: expiração preguiçosa). */
export class CommitThenThrow extends Error {
  constructor(inner) { super(inner.message); this.inner = inner; }
}

/** Executa fn dentro de uma transação READ COMMITTED com bloqueios explícitos de linha. */
export async function tx(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      if (err instanceof CommitThenThrow) {
        await client.query('COMMIT');
        throw err.inner;
      }
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
}
