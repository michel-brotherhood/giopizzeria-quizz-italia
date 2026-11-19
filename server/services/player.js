// Fluxo do jogador em campanha autorizada.
// Ordem de bloqueio (evita deadlock): invitation | quiz_session | voucher  ->  campaign (sempre por último).
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { config } from '../config.js';
import { tx, CommitThenThrow } from '../db/pool.js';
import { err } from '../errors.js';
import { drawRound, isCorrect, publicQuestion, ROUND_SIZE, POINTS_PER_CORRECT } from '../../shared/quiz.js';
import { QUESTIONS, CONTENT_VERSION } from './content.js';
import { randomToken, sha256, shortCode, formatCode, encrypt, decrypt } from './crypto.js';
import { idempotent } from './idempotency.js';
import { audit } from './audit.js';

const cryptoRng = () => crypto.randomInt(0, 2 ** 32) / 2 ** 32;
const minDate = (...ds) => new Date(Math.min(...ds.filter(Boolean).map((d) => new Date(d).getTime())));

async function addCredential(c, sessionId) {
  const token = randomToken();
  await c.query('INSERT INTO player_credentials (session_id, token_hash) VALUES ($1,$2)', [sessionId, sha256(token)]);
  return token;
}

/** Expira sessão ativa vencida, liberando a reserva uma única vez (condicional ao estado). */
async function expireSessionIfDue(c, s, now = new Date()) {
  if (s.state !== 'active' || new Date(s.expires_at) > now) return false;
  const r = await c.query(
    `UPDATE quiz_sessions SET state='expired', reservation_state='released'
     WHERE id=$1 AND state='active' AND reservation_state='reserved'`, [s.id]);
  if (r.rowCount === 1) {
    await c.query('UPDATE campaigns SET reserved_count = reserved_count - 1, updated_at=now() WHERE id=$1', [s.campaign_id]);
    await audit(c, 'session.expired', { campaignId: s.campaign_id, sessionId: s.id });
    s.state = 'expired'; s.reservation_state = 'released';
  }
  return true;
}

/** Expira voucher emitido vencido, devolvendo a unidade comprometida uma única vez. */
export async function expireVoucherIfDue(c, v, now = new Date()) {
  if (v.state !== 'issued' || new Date(v.expires_at) > now) return false;
  const r = await c.query(`UPDATE vouchers SET state='expired' WHERE id=$1 AND state='issued'`, [v.id]);
  if (r.rowCount === 1) {
    await c.query('UPDATE campaigns SET awarded_count = awarded_count - 1, updated_at=now() WHERE id=$1', [v.campaign_id]);
    await audit(c, 'voucher.expired', { campaignId: v.campaign_id, voucherId: v.id, sessionId: v.session_id });
    v.state = 'expired';
  }
  return true;
}

/** POST /api/player/exchange — troca convite por sessão, reservando 1 unidade. Idempotente por convite. */
export async function exchangeInvitation(pool, inviteToken, registrationId = null) {
  if (typeof inviteToken !== 'string' || inviteToken.length < 20 || inviteToken.length > 200) throw err('INVITATION_INVALID');
  return tx(pool, async (c) => {
    const { rows: [inv] } = await c.query('SELECT * FROM invitations WHERE token_hash=$1 FOR UPDATE', [sha256(inviteToken)]);
    if (!inv) throw err('INVITATION_INVALID');
    if (inv.state === 'cancelled') throw err('INVITATION_CANCELLED');

    if (inv.state === 'exchanged') {
      // Retomada: mesma sessão, nenhuma nova reserva.
      const { rows: [s] } = await c.query('SELECT * FROM quiz_sessions WHERE invitation_id=$1 FOR UPDATE', [inv.id]);
      if (await expireSessionIfDue(c, s)) throw new CommitThenThrow(err('SESSION_EXPIRED'));
      if (s.state === 'expired') throw err('SESSION_EXPIRED');
      if (s.state === 'cancelled') throw err('SESSION_CANCELLED');
      const credential = await addCredential(c, s.id);
      await audit(c, 'session.resumed_by_invitation', { campaignId: s.campaign_id, sessionId: s.id });
      return { credential, sessionId: s.id, resumed: true };
    }

    const now = new Date();
    if (inv.state === 'expired' || new Date(inv.expires_at) <= now) throw err('INVITATION_EXPIRED');

    const { rows: [camp] } = await c.query('SELECT * FROM campaigns WHERE id=$1 FOR UPDATE', [inv.campaign_id]);
    if (camp.state === 'paused') throw err('CAMPAIGN_PAUSED');
    if (camp.state !== 'active') throw err('CAMPAIGN_DISABLED');
    if (camp.is_test && config.isProd) throw err('CAMPAIGN_DISABLED');
    if (new Date(camp.starts_at) > now) throw err('CAMPAIGN_NOT_STARTED');
    if (now.getTime() + camp.min_play_minutes * 60_000 > new Date(camp.ends_at).getTime()) throw err('CAMPAIGN_ENDED');
    if (camp.total_stock - camp.reserved_count - camp.awarded_count <= 0) throw err('OUT_OF_STOCK');

    const round = drawRound(QUESTIONS, cryptoRng);
    const expiresAt = minDate(now.getTime() + camp.session_ttl_minutes * 60_000, camp.ends_at);
    const { rows: [s] } = await c.query(
      `INSERT INTO quiz_sessions (public_id, campaign_id, invitation_id, content_version, question_order, expires_at, registration_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [randomToken(12), camp.id, inv.id, CONTENT_VERSION, JSON.stringify(round), expiresAt.toISOString(), registrationId],
    );
    await c.query('UPDATE campaigns SET reserved_count = reserved_count + 1, updated_at=now() WHERE id=$1', [camp.id]);
    await c.query(`UPDATE invitations SET state='exchanged', exchanged_at=now() WHERE id=$1`, [inv.id]);
    const credential = await addCredential(c, s.id);
    await audit(c, 'session.started', { campaignId: camp.id, sessionId: s.id });
    return { credential, sessionId: s.id, resumed: false };
  });
}

export async function sessionIdFromCredential(db, token) {
  if (typeof token !== 'string' || token.length < 20) return null;
  const { rows } = await db.query('SELECT session_id FROM player_credentials WHERE token_hash=$1', [sha256(token)]);
  return rows[0]?.session_id ?? null;
}

async function loadAnswers(db, sessionId) {
  const { rows } = await db.query('SELECT * FROM answers WHERE session_id=$1 ORDER BY position', [sessionId]);
  return rows;
}

function feedbackFor(q, a, order) {
  const nextQ = order && a.position + 1 < ROUND_SIZE ? publicQuestion(order[a.position + 1]) : null;
  return {
    ...(order ? { next: nextQ } : {}),
    position: a.position,
    questionId: q.id,
    selectedOptionId: a.selected_option_id,
    correct: a.is_correct,
    correctOptionId: q.correctOptionId,
    explanation: q.explanation,
    sourceId: q.sourceId,
  };
}

export async function voucherView(v, { withCredential = true } = {}) {
  if (!v) return null;
  const view = {
    state: v.state,
    rewardName: v.reward_name,
    quantity: v.quantity,
    rulesText: v.rules_text,
    isTest: v.is_test,
    issuedAt: v.issued_at,
    expiresAt: v.expires_at,
    redeemedAt: v.redeemed_at,
  };
  if (withCredential && v.state === 'issued') {
    let creds;
    try { creds = decrypt(v.token_enc); } catch {
      // Chave mudou (troca de SESSION_SECRET): não derruba a tela; a equipe precisa conferir pela conta.
      view.credentialUnavailable = true;
      return view;
    }
    const { token, code } = creds;
    view.code = formatCode(code);
    // QR aponta para o painel da equipe com o token no fragmento (#): não é enviado em GET.
    view.qrSvg = await QRCode.toString(`${config.PUBLIC_BASE_URL}/equipe/#v=${token}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#041E42', light: '#FFFFFF' } });
  }
  return view;
}

/** Estado canônico da sessão (expiração preguiçosa incluída). */
export async function getSessionState(pool, sessionId) {
  return tx(pool, async (c) => {
    const { rows: [s] } = await c.query('SELECT * FROM quiz_sessions WHERE id=$1 FOR UPDATE', [sessionId]);
    if (!s) throw err('SESSION_REQUIRED');
    await expireSessionIfDue(c, s);
    let { rows: [v] } = await c.query('SELECT * FROM vouchers WHERE session_id=$1 FOR UPDATE', [s.id]);
    if (v) await expireVoucherIfDue(c, v);
    const { rows: [camp] } = await c.query('SELECT name, reward_name, quantity_per_voucher, rules_text, is_test, award_rule, min_correct, every_n FROM campaigns WHERE id=$1', [s.campaign_id]);
    const answers = await loadAnswers(c, s.id);
    const order = s.question_order;
    const current = s.state === 'active' && answers.length < ROUND_SIZE ? publicQuestion(order[answers.length]) : null;
    return {
      serverTime: new Date().toISOString(),
      session: {
        id: s.public_id,
        state: s.state,
        expiresAt: s.expires_at,
        completedAt: s.completed_at,
        score: s.score,
        awardOutcome: s.award_outcome,
        answeredCount: answers.length,
        total: ROUND_SIZE,
        current,
        answered: answers.map((a) => ({ question: publicQuestion(order[a.position]), ...feedbackFor(order[a.position], a) })),
        campaign: { name: camp.name, rewardName: camp.reward_name, quantityPerVoucher: camp.quantity_per_voucher, rulesText: camp.rules_text, isTest: camp.is_test, awardRule: camp.award_rule, minCorrect: camp.min_correct, everyN: camp.every_n },
      },
      voucher: await voucherView(v),
    };
  });
}

/** POST /api/player/session/answer — uma resposta por pergunta, em sequência. */
export async function answerQuestion(pool, sessionId, { questionId, selectedOptionId }, idemKey) {
  if (typeof questionId !== 'string' || typeof selectedOptionId !== 'string') throw err('BAD_REQUEST');
  return tx(pool, async (c) => {
    const { rows: [s] } = await c.query('SELECT * FROM quiz_sessions WHERE id=$1 FOR UPDATE', [sessionId]);
    if (!s) throw err('SESSION_REQUIRED');
    return idempotent(c, `player:${s.id}:answer`, idemKey, { questionId, selectedOptionId }, async () => {
      const order = s.question_order;
      const { rows: [existing] } = await c.query('SELECT * FROM answers WHERE session_id=$1 AND question_id=$2', [s.id, questionId]);
      if (existing) {
        if (existing.selected_option_id !== selectedOptionId) throw err('ANSWER_CONFLICT');
        const q = order[existing.position];
        return { ...feedbackFor(q, existing, order), score: s.score, answeredCount: (await loadAnswers(c, s.id)).length, duplicate: true };
      }
      if (await expireSessionIfDue(c, s)) throw new CommitThenThrow(err('SESSION_EXPIRED'));
      if (s.state === 'completed') throw err('SESSION_COMPLETED');
      if (s.state === 'expired') throw err('SESSION_EXPIRED');
      if (s.state === 'cancelled') throw err('SESSION_CANCELLED');
      const answers = await loadAnswers(c, s.id);
      const position = answers.length;
      if (position >= ROUND_SIZE || order[position].id !== questionId) throw err('QUESTION_OUT_OF_ORDER');
      const q = order[position];
      let correct;
      try { correct = isCorrect(q, selectedOptionId); } catch { throw err('INVALID_OPTION'); }
      const { rows: [a] } = await c.query(
        `INSERT INTO answers (session_id, position, question_id, selected_option_id, is_correct)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`, [s.id, position, questionId, selectedOptionId, correct]);
      const score = s.score + (correct ? POINTS_PER_CORRECT : 0);
      await c.query('UPDATE quiz_sessions SET score=$2 WHERE id=$1', [s.id, score]);
      return { ...feedbackFor(q, a, order), score, answeredCount: position + 1, duplicate: false };
    });
  });
}

/**
 * Decide o prêmio de uma partida concluída (campanha já bloqueada em FOR UPDATE).
 * participation: sempre; min_score: acertos >= min_correct; every_n: entre as qualificadas, cada N-ésima.
 */
async function decideAward(c, camp, correct) {
  if (camp.award_rule === 'participation') return 'awarded';
  if (correct < camp.min_correct) return 'not_qualified';
  if (camp.award_rule === 'min_score') return 'awarded';
  const { rows: [{ qualified_count: q }] } = await c.query(
    'UPDATE campaigns SET qualified_count = qualified_count + 1 WHERE id=$1 RETURNING qualified_count', [camp.id]);
  return q % camp.every_n === 0 ? 'awarded' : 'qualified_no_prize';
}

/** POST /api/player/session/complete — converte a reserva em voucher único. Repetição devolve o mesmo. */
export async function completeSession(pool, sessionId, idemKey) {
  const voucherId = await tx(pool, async (c) => {
    const { rows: [s] } = await c.query('SELECT * FROM quiz_sessions WHERE id=$1 FOR UPDATE', [sessionId]);
    if (!s) throw err('SESSION_REQUIRED');
    const result = await idempotent(c, `player:${s.id}:complete`, idemKey, { complete: true }, async () => {
      const { rows: [existing] } = await c.query('SELECT id FROM vouchers WHERE session_id=$1', [s.id]);
      if (existing) return { voucherId: existing.id };
      if (s.state === 'completed') return { voucherId: null }; // concluída sem prêmio: repetição é inofensiva
      if (await expireSessionIfDue(c, s)) throw new CommitThenThrow(err('SESSION_EXPIRED'));
      if (s.state === 'expired') throw err('SESSION_EXPIRED');
      if (s.state === 'cancelled') throw err('SESSION_CANCELLED');
      const { rows: [{ n }] } = await c.query('SELECT count(*)::int AS n FROM answers WHERE session_id=$1', [s.id]);
      if (n !== ROUND_SIZE) throw err('SESSION_INCOMPLETE');

      const { rows: [camp] } = await c.query('SELECT * FROM campaigns WHERE id=$1 FOR UPDATE', [s.campaign_id]);
      // Premiação decidida aqui, no servidor, com a campanha bloqueada (contagem sem corrida).
      const { rows: [{ correct }] } = await c.query('SELECT count(*) FILTER (WHERE is_correct)::int AS correct FROM answers WHERE session_id=$1', [s.id]);
      const outcome = await decideAward(c, camp, correct);
      if (outcome !== 'awarded') {
        await c.query(`UPDATE quiz_sessions SET state='completed', reservation_state='released', award_outcome=$2, completed_at=now()
                       WHERE id=$1 AND state='active' AND reservation_state='reserved'`, [s.id, outcome]);
        await c.query('UPDATE campaigns SET reserved_count = reserved_count - 1, updated_at=now() WHERE id=$1', [camp.id]);
        await audit(c, 'session.completed_no_award', { campaignId: camp.id, sessionId: s.id, details: { outcome, correct } });
        return { voucherId: null };
      }
      const now = new Date();
      const token = randomToken(32);
      const code = shortCode(10);
      const expiresAt = minDate(now.getTime() + camp.reward_ttl_minutes * 60_000, camp.ends_at);
      const { rows: [v] } = await c.query(
        `INSERT INTO vouchers (session_id, campaign_id, token_hash, short_code_hash, token_enc, reward_name, quantity,
                               rules_text, rules_version, is_test, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [s.id, camp.id, sha256(token), sha256(`code:${code}`), encrypt({ token, code }), camp.reward_name,
          camp.quantity_per_voucher, camp.rules_text, camp.rules_version, camp.is_test, expiresAt.toISOString()]);
      await c.query(`UPDATE quiz_sessions SET state='completed', reservation_state='converted', award_outcome='awarded', completed_at=now()
                     WHERE id=$1 AND state='active' AND reservation_state='reserved'`, [s.id]);
      await c.query(`UPDATE campaigns SET reserved_count = reserved_count - 1, awarded_count = awarded_count + 1, updated_at=now()
                     WHERE id=$1`, [camp.id]);
      await audit(c, 'voucher.issued', { campaignId: camp.id, sessionId: s.id, voucherId: v.id, details: { rule: camp.award_rule, correct } });
      return { voucherId: v.id };
    });
    return result.voucherId;
  });
  const state = await getSessionState(pool, sessionId);
  return { ...state, voucherId: undefined, completedVoucher: Boolean(voucherId) };
}
