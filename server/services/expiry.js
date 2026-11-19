// Rotina periódica: libera reservas de sessões vencidas e unidades de vouchers vencidos.
// Usa os mesmos bloqueios e atualizações condicionais dos endpoints (idempotente).
import { tx } from '../db/pool.js';
import { audit } from './audit.js';

export async function sweepExpired(pool, batch = 100) {
  const out = { sessions: 0, vouchers: 0, invitations: 0 };
  out.sessions = await tx(pool, async (c) => {
    const { rows } = await c.query(
      `SELECT id, campaign_id FROM quiz_sessions WHERE state='active' AND expires_at <= now()
       ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED`, [batch]);
    let n = 0;
    for (const s of rows) {
      const r = await c.query(`UPDATE quiz_sessions SET state='expired', reservation_state='released'
                               WHERE id=$1 AND state='active' AND reservation_state='reserved'`, [s.id]);
      if (r.rowCount) {
        await c.query('UPDATE campaigns SET reserved_count = reserved_count - 1, updated_at=now() WHERE id=$1', [s.campaign_id]);
        await audit(c, 'session.expired', { campaignId: s.campaign_id, sessionId: s.id, details: { by: 'sweep' } });
        n++;
      }
    }
    return n;
  });
  out.vouchers = await tx(pool, async (c) => {
    const { rows } = await c.query(
      `SELECT id, campaign_id, session_id FROM vouchers WHERE state='issued' AND expires_at <= now()
       ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED`, [batch]);
    let n = 0;
    for (const v of rows) {
      const r = await c.query(`UPDATE vouchers SET state='expired' WHERE id=$1 AND state='issued'`, [v.id]);
      if (r.rowCount) {
        await c.query('UPDATE campaigns SET awarded_count = awarded_count - 1, updated_at=now() WHERE id=$1', [v.campaign_id]);
        await audit(c, 'voucher.expired', { campaignId: v.campaign_id, voucherId: v.id, sessionId: v.session_id, details: { by: 'sweep' } });
        n++;
      }
    }
    return n;
  });
  const r = await pool.query(`UPDATE invitations SET state='expired' WHERE state='created' AND expires_at <= now()`);
  out.invitations = r.rowCount;
  await pool.query(`DELETE FROM idempotency_keys WHERE created_at < now() - interval '2 days'`);
  return out;
}

export function startExpiryLoop(pool, seconds, log = console.log) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const r = await sweepExpired(pool);
      if (r.sessions || r.vouchers) log(`[expiry] sessões=${r.sessions} vouchers=${r.vouchers} convites=${r.invitations}`);
    } catch (e) {
      log(`[expiry] falha: ${e.message}`);
    } finally {
      running = false;
    }
  }, seconds * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
