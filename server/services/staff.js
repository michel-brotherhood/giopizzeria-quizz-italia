// Equipe: autenticação, convites, consulta e confirmação de entrega.
import { config } from '../config.js';
import { tx, CommitThenThrow } from '../db/pool.js';
import { err } from '../errors.js';
import { randomToken, sha256, hmac, verifyPassword, normalizeCode, formatCode } from './crypto.js';
import { idempotent } from './idempotency.js';
import { audit } from './audit.js';
import { expireVoucherIfDue } from './player.js';
import { getCurrentForStaff } from './campaigns.js';

// Hash fixo para igualar o tempo de resposta quando o usuário não existe.
const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

export async function login(pool, username, password) {
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password || password.length > 200) {
    throw err('INVALID_CREDENTIALS');
  }
  const { rows: [op] } = await pool.query('SELECT * FROM operators WHERE username=$1 AND active', [username.trim().toLowerCase()]);
  const ok = await verifyPassword(password, op?.password_hash ?? DUMMY_HASH);
  if (!op || !ok) throw err('INVALID_CREDENTIALS');
  const token = randomToken();
  const csrf = randomToken(24);
  const expiresAt = new Date(Date.now() + config.STAFF_SESSION_HOURS * 3600_000);
  await pool.query('INSERT INTO staff_sessions (operator_id, token_hash, csrf_token, expires_at) VALUES ($1,$2,$3,$4)',
    [op.id, sha256(token), csrf, expiresAt.toISOString()]);
  await audit(pool, 'staff.login', { operatorId: op.id });
  return { token, csrf, expiresAt, operator: operatorView(op) };
}

export function operatorView(op) {
  return { id: op.id, username: op.username, displayName: op.display_name, role: op.role };
}

export async function staffFromToken(db, token) {
  if (typeof token !== 'string' || token.length < 20) return null;
  const { rows: [r] } = await db.query(
    `SELECT o.*, s.id AS staff_session_id, s.csrf_token FROM staff_sessions s JOIN operators o ON o.id = s.operator_id
     WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now() AND o.active`, [sha256(token)]);
  return r ?? null;
}

export async function logout(pool, staff) {
  await pool.query('UPDATE staff_sessions SET revoked_at=now() WHERE id=$1', [staff.staff_session_id]);
  await audit(pool, 'staff.logout', { operatorId: staff.id });
}

export function normalizeAccountRef(ref) {
  const s = String(ref ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!/^[A-Z0-9 #/._-]{1,40}$/.test(s)) throw err('BAD_REQUEST', { field: 'accountRef' }, 'Referência de conta inválida (use número/código da comanda, até 40 caracteres).');
  return s;
}

const hintOf = (ref) => (ref.length <= 3 ? '•'.repeat(ref.length) : `•••${ref.slice(-3)}`);

/**
 * Cria (ou reaproveita) o convite de uma conta na campanha ativa.
 * - novo: cria convite;
 * - ainda não usado: gera novo link para o MESMO convite (o anterior deixa de valer);
 * - já usado com partida ativa/concluída: novo link de recuperação que leva à MESMA sessão (sem nova reserva/voucher);
 * - partida expirada/cancelada: recusa (conta já participou).
 */
export async function createInvitation(pool, staff, accountRefInput, attempt = 0) {
  const accountRef = normalizeAccountRef(accountRefInput);
  try {
    return await tx(pool, async (c) => {
      const { rows: [camp] } = await c.query(`SELECT * FROM campaigns WHERE state='active' ${config.isProd ? 'AND NOT is_test' : ''} LIMIT 1`);
      if (!camp) {
        const paused = await getCurrentForStaff(c);
        throw err(paused?.state === 'paused' ? 'CAMPAIGN_PAUSED' : 'CAMPAIGN_DISABLED');
      }
      const refHash = hmac(`acct:${camp.id}:${accountRef}`);
      const token = randomToken();
      const expiresAt = new Date(Date.now() + camp.invitation_ttl_minutes * 60_000).toISOString();
      const { rows: [inv] } = await c.query('SELECT * FROM invitations WHERE campaign_id=$1 AND account_ref_hash=$2 FOR UPDATE', [camp.id, refHash]);
      let kind;
      if (!inv) {
        if (camp.total_stock - camp.reserved_count - camp.awarded_count <= 0) throw err('OUT_OF_STOCK');
        await c.query(
          `INSERT INTO invitations (campaign_id, account_ref_hash, account_ref_hint, token_hash, created_by, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6)`, [camp.id, refHash, hintOf(accountRef), sha256(token), staff.id, expiresAt]);
        kind = 'created';
      } else if (inv.state === 'cancelled') {
        throw err('INVITATION_CANCELLED');
      } else if (inv.state === 'exchanged') {
        const { rows: [s] } = await c.query('SELECT state FROM quiz_sessions WHERE invitation_id=$1', [inv.id]);
        if (!['active', 'completed'].includes(s.state)) throw err('INVITATION_USED', { sessionState: s.state });
        await c.query('UPDATE invitations SET token_hash=$2, reissue_count=reissue_count+1 WHERE id=$1', [inv.id, sha256(token)]);
        kind = 'recovery';
      } else {
        await c.query(`UPDATE invitations SET token_hash=$2, state='created', expires_at=$3, reissue_count=reissue_count+1 WHERE id=$1`,
          [inv.id, sha256(token), expiresAt]);
        kind = 'reissued';
      }
      await audit(c, `invitation.${kind}`, { operatorId: staff.id, campaignId: camp.id, details: { accountRefHint: hintOf(accountRef) } });
      return {
        kind,
        accountRefHint: hintOf(accountRef),
        expiresAt: kind === 'recovery' ? null : expiresAt,
        // Token no fragmento: não trafega em GET, não aparece em log de servidor/proxy.
        url: `${config.PUBLIC_BASE_URL}/#convite=${token}`,
      };
    });
  } catch (e) {
    // Duas criações simultâneas para a mesma conta: a segunda reaproveita o convite da primeira.
    if (e.code === '23505' && attempt === 0) return createInvitation(pool, staff, accountRefInput, 1);
    throw e;
  }
}

async function findVoucher(c, input, lock) {
  const raw = String(input ?? '').trim();
  if (!raw || raw.length > 300) throw err('VOUCHER_NOT_FOUND');
  // Aceita: URL lida do QR (…#v=TOKEN), token puro ou código curto digitado.
  const m = raw.match(/[#&?]v=([A-Za-z0-9_-]{20,})/);
  const token = m ? m[1] : (/^[A-Za-z0-9_-]{40,}$/.test(raw) ? raw : null);
  const sql = `SELECT v.*, i.account_ref_hint FROM vouchers v
               JOIN quiz_sessions s ON s.id = v.session_id JOIN invitations i ON i.id = s.invitation_id
               WHERE ${token ? 'v.token_hash=$1' : 'v.short_code_hash=$1'} ${lock ? 'FOR UPDATE OF v' : ''}`;
  const { rows: [v] } = await c.query(sql, [token ? sha256(token) : sha256(`code:${normalizeCode(raw)}`)]);
  if (!v) throw err('VOUCHER_NOT_FOUND');
  return v;
}

function staffVoucherView(v, operatorName) {
  return {
    state: v.state,
    rewardName: v.reward_name,
    quantity: v.quantity,
    rulesText: v.rules_text,
    isTest: v.is_test,
    accountRefHint: v.account_ref_hint,
    issuedAt: v.issued_at,
    expiresAt: v.expires_at,
    redeemedAt: v.redeemed_at,
    redeemedBy: operatorName ?? null,
  };
}

async function operatorName(c, id) {
  if (!id) return null;
  const { rows: [o] } = await c.query('SELECT display_name FROM operators WHERE id=$1', [id]);
  return o?.display_name ?? null;
}

/** Consulta sem consumir. */
export async function lookupVoucher(pool, staff, input) {
  return tx(pool, async (c) => {
    const v = await findVoucher(c, input, true);
    await expireVoucherIfDue(c, v); // expiração preguiçosa (efeito idempotente e auditado)
    await audit(c, 'voucher.lookup', { operatorId: staff.id, campaignId: v.campaign_id, voucherId: v.id });
    return staffVoucherView(v, await operatorName(c, v.redeemed_by));
  });
}

/** Confirma entrega: issued -> redeemed, atômico, uma única vez. */
export async function redeemVoucher(pool, staff, input, idemKey) {
  return tx(pool, async (c) => {
    return idempotent(c, `staff:${staff.id}:redeem`, idemKey, { input: sha256(String(input ?? '')) }, async () => {
      const v = await findVoucher(c, input, true);
      if (await expireVoucherIfDue(c, v)) throw new CommitThenThrow(err('VOUCHER_EXPIRED'));
      if (v.state === 'redeemed') {
        throw err('ALREADY_REDEEMED', { redeemedAt: v.redeemed_at, redeemedBy: await operatorName(c, v.redeemed_by) });
      }
      if (v.state === 'expired') throw err('VOUCHER_EXPIRED');
      if (v.state === 'cancelled') throw err('VOUCHER_CANCELLED');
      const { rows: [u] } = await c.query(
        `UPDATE vouchers SET state='redeemed', redeemed_at=now(), redeemed_by=$2 WHERE id=$1 AND state='issued' RETURNING *`,
        [v.id, staff.id]);
      await c.query('UPDATE campaigns SET redeemed_count = redeemed_count + 1, updated_at=now() WHERE id=$1', [v.campaign_id]);
      await audit(c, 'voucher.redeemed', { operatorId: staff.id, campaignId: v.campaign_id, voucherId: v.id });
      return staffVoucherView({ ...u, account_ref_hint: v.account_ref_hint }, staff.display_name);
    });
  });
}

export async function recentInvitations(db, campaignId) {
  const { rows } = await db.query(
    `SELECT i.account_ref_hint, i.state, i.created_at, i.expires_at, s.state AS session_state, s.score, v.state AS voucher_state
     FROM invitations i LEFT JOIN quiz_sessions s ON s.invitation_id=i.id LEFT JOIN vouchers v ON v.session_id=s.id
     WHERE i.campaign_id=$1 ORDER BY i.created_at DESC LIMIT 20`, [campaignId]);
  return rows.map((r) => ({
    accountRefHint: r.account_ref_hint, state: r.state, createdAt: r.created_at, expiresAt: r.expires_at,
    sessionState: r.session_state, score: r.score, voucherState: r.voucher_state,
  }));
}

export { formatCode };
