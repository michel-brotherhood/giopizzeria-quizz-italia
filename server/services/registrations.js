// Cadastro de participantes (LGPD): nome, WhatsApp e e-mail, aceite da política (versão + data) e
// aceite de promoções separado, opcional e desmarcado por padrão. Logs e auditoria nunca levam os dados.
import { err } from '../errors.js';
import { tx } from '../db/pool.js';
import { randomToken, sha256 } from './crypto.js';
import { audit } from './audit.js';
import { ALL_PLAYS_SQL, questionStats } from './plays.js';

export const PRIVACY_VERSION = '2026-11-19';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,63}\.[^\s@]{2,}$/;

/** Normaliza e valida; devolve os dados limpos ou lança BAD_REQUEST com os campos inválidos. */
export function normalizeRegistration(body = {}) {
  const fields = {};
  const name = String(body.name ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 80) fields.name = 'Informe seu nome.';
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 120) fields.email = 'Informe um e-mail válido.';
  let phone = String(body.phone ?? '').replace(/\D/g, '');
  if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
  if (!/^55[1-9][0-9][0-9]{8,9}$/.test(phone)) fields.phone = 'Informe um WhatsApp com DDD.';
  if (body.acceptPrivacy !== true) fields.acceptPrivacy = 'É preciso aceitar a Política de Privacidade para participar.';
  if (Object.keys(fields).length) throw err('REGISTRATION_INVALID', { fields });
  return { name, email, phone, marketing: body.marketingConsent === true };
}

const firstName = (name) => name.split(' ')[0];

/** Cria ou atualiza (por e-mail) e emite uma credencial nova para este aparelho. */
export async function register(pool, body) {
  const d = normalizeRegistration(body);
  return tx(pool, async (c) => {
    const { rows: [row] } = await c.query(
      `INSERT INTO registrations (name, email, phone, marketing_consent, marketing_consent_at, privacy_version)
       VALUES ($1,$2,$3,$4, CASE WHEN $4 THEN now() END, $5)
       ON CONFLICT (lower(email)) DO UPDATE SET
         name = EXCLUDED.name, phone = EXCLUDED.phone,
         marketing_consent = EXCLUDED.marketing_consent,
         marketing_consent_at = CASE WHEN EXCLUDED.marketing_consent
           THEN COALESCE(registrations.marketing_consent_at, now()) END,
         privacy_version = EXCLUDED.privacy_version, privacy_accepted_at = now(), updated_at = now()
       RETURNING id, name, (xmax = 0) AS inserted`,
      [d.name, d.email, d.phone, d.marketing, PRIVACY_VERSION],
    );
    const token = randomToken();
    await c.query('INSERT INTO registration_credentials (token_hash, registration_id) VALUES ($1,$2)', [sha256(token), row.id]);
    await audit(c, row.inserted ? 'registration.created' : 'registration.updated', { details: { registrationId: row.id, marketing: d.marketing } });
    return { token, registrationId: row.id, firstName: firstName(row.name) };
  });
}

export async function registrationFromToken(db, token) {
  if (typeof token !== 'string' || token.length < 20) return null;
  const { rows } = await db.query(
    `SELECT r.id, r.name FROM registration_credentials rc JOIN registrations r ON r.id = rc.registration_id WHERE rc.token_hash=$1`,
    [sha256(token)]);
  return rows[0] ? { id: rows[0].id, firstName: firstName(rows[0].name) } : null;
}

// ---------- equipe (somente gerente) ----------
const PAGE_SIZE = 50;

// Estatísticas de partidas por cadastro (livres + com brinde) e brindes emitidos.
const PER_REG_SQL = `
  WITH plays AS (${ALL_PLAYS_SQL}),
  agg AS (SELECT registration_id, count(*)::int plays, max(correct)::int best,
                 round(avg(correct)::numeric, 1)::float avg, max(completed_at) last_play
          FROM plays GROUP BY registration_id),
  vou AS (SELECT s.registration_id, count(*)::int vouchers,
                 count(*) FILTER (WHERE v.state = 'redeemed')::int redeemed
          FROM vouchers v JOIN quiz_sessions s ON s.id = v.session_id
          WHERE s.registration_id IS NOT NULL GROUP BY s.registration_id)`;

const PER_REG_COLS = `COALESCE(agg.plays, 0) plays, agg.best, agg.avg, agg.last_play,
  COALESCE(vou.vouchers, 0) vouchers, COALESCE(vou.redeemed, 0) redeemed`;
const PER_REG_JOIN = 'LEFT JOIN agg ON agg.registration_id = r.id LEFT JOIN vou ON vou.registration_id = r.id';

/** Filtros da lista: texto (nome, e-mail ou WhatsApp) e só quem aceita promoções. */
function listFilter({ q, marketing } = {}) {
  const where = [];
  const params = [];
  const text = String(q ?? '').trim().slice(0, 80);
  if (text) {
    const like = '%' + text.replace(/[%_\\]/g, (m) => '\\' + m) + '%';
    params.push(like);
    let cond = `(r.name ILIKE $${params.length} OR r.email ILIKE $${params.length}`;
    const digits = text.replace(/\D/g, '');
    if (digits.length >= 4) { params.push(`%${digits}%`); cond += ` OR r.phone LIKE $${params.length}`; }
    where.push(`${cond})`);
  }
  if (marketing === true || marketing === 'true' || marketing === '1') where.push('r.marketing_consent');
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function registrationSummary(pool, opts = {}) {
  const { rows: [t] } = await pool.query(
    `SELECT count(*)::int total, count(*) FILTER (WHERE marketing_consent)::int marketing,
            count(*) FILTER (WHERE created_at > now() - interval '1 day')::int last24h FROM registrations`);
  const { rows: [p] } = await pool.query(
    `WITH plays AS (${ALL_PLAYS_SQL})
     SELECT count(*)::int plays, count(*) FILTER (WHERE completed_at > now() - interval '1 day')::int plays24h,
            count(DISTINCT registration_id)::int players, round(avg(correct)::numeric, 1)::float avg_correct,
            count(*) FILTER (WHERE correct >= 7)::int high FROM plays`);
  const { rows: dist } = await pool.query(
    `WITH plays AS (${ALL_PLAYS_SQL}) SELECT correct, count(*)::int n FROM plays GROUP BY correct`);
  const distribution = Array.from({ length: 9 }, (_, i) => dist.find((d) => d.correct === i)?.n ?? 0);

  const page = Math.max(1, Math.min(10_000, Number.parseInt(opts.page, 10) || 1));
  const f = listFilter(opts);
  const { rows: [{ n: matched }] } = await pool.query(`SELECT count(*)::int n FROM registrations r ${f.sql}`, f.params);
  const { rows } = await pool.query(
    `${PER_REG_SQL}
     SELECT r.name, r.email, r.phone, r.marketing_consent, r.created_at, ${PER_REG_COLS}
     FROM registrations r ${PER_REG_JOIN}
     ${f.sql} ORDER BY r.created_at DESC, r.id DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`, f.params);
  return {
    ...t,
    plays: p.plays, plays24h: p.plays24h, players: p.players, avgCorrect: p.avg_correct, highScores: p.high,
    distribution,
    questions: await questionStats(pool),
    matched, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(matched / PAGE_SIZE)),
    recent: rows.map((r) => ({
      name: r.name, email: r.email, phone: r.phone, marketing: r.marketing_consent, createdAt: r.created_at,
      plays: r.plays, best: r.best, avg: r.avg, lastPlay: r.last_play, vouchers: r.vouchers, redeemed: r.redeemed,
    })),
  };
}

// Evita injeção de fórmula ao abrir o CSV em planilhas.
const cell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function registrationsCsv(pool, operator) {
  const { rows } = await pool.query(
    `${PER_REG_SQL}
     SELECT r.name, r.email, r.phone, r.marketing_consent, r.marketing_consent_at, r.privacy_version,
            r.privacy_accepted_at, r.created_at, ${PER_REG_COLS}
     FROM registrations r ${PER_REG_JOIN} ORDER BY r.created_at`);
  await audit(pool, 'registration.exported', { operatorId: operator.id, details: { rows: rows.length } });
  const head = ['nome', 'email', 'whatsapp', 'aceita_promocoes', 'promocoes_aceitas_em', 'versao_politica', 'politica_aceita_em', 'cadastrado_em',
    'partidas', 'melhor_acerto_de_8', 'media_acertos', 'ultima_partida', 'brindes_emitidos', 'brindes_entregues'];
  const lines = rows.map((r) => [r.name, r.email, `+${r.phone}`, r.marketing_consent ? 'sim' : 'nao',
    r.marketing_consent_at?.toISOString() ?? '', r.privacy_version, r.privacy_accepted_at.toISOString(), r.created_at.toISOString(),
    r.plays, r.best ?? '', r.avg ?? '', r.last_play?.toISOString() ?? '', r.vouchers, r.redeemed].map(cell).join(','));
  return '﻿' + [head.join(','), ...lines].join('\r\n') + '\r\n';
}

/** Atende pedido de exclusão (direito do titular). */
export async function deleteRegistration(pool, operator, email) {
  const e = String(email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(e)) throw err('REGISTRATION_INVALID', { fields: { email: 'Informe um e-mail válido.' } });
  return tx(pool, async (c) => {
    const { rows } = await c.query('DELETE FROM registrations WHERE lower(email)=$1 RETURNING id', [e]);
    if (!rows.length) throw err('REGISTRATION_NOT_FOUND');
    await audit(c, 'registration.deleted', { operatorId: operator.id, details: { registrationId: rows[0].id } });
    return { deleted: true };
  });
}
