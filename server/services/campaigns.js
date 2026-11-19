import { config } from '../config.js';
import { err } from '../errors.js';
import { tx } from '../db/pool.js';
import { audit } from './audit.js';

export function campaignView(c, { full = false } = {}) {
  if (!c) return null;
  const available = c.total_stock - c.reserved_count - c.awarded_count;
  const base = {
    id: c.id,
    name: c.name,
    isTest: c.is_test,
    state: c.state,
    rewardName: c.reward_name,
    quantityPerVoucher: c.quantity_per_voucher,
    rulesText: c.rules_text,
    rulesVersion: c.rules_version,
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    hasStock: available > 0,
  };
  if (!full) return base;
  return {
    ...base,
    invitationTtlMinutes: c.invitation_ttl_minutes,
    sessionTtlMinutes: c.session_ttl_minutes,
    rewardTtlMinutes: c.reward_ttl_minutes,
    minPlayMinutes: c.min_play_minutes,
    totalStock: c.total_stock,
    reservedCount: c.reserved_count,
    awardedCount: c.awarded_count,
    redeemedCount: c.redeemed_count,
    available,
  };
}

export async function getActiveCampaign(db) {
  const { rows } = await db.query(
    `SELECT * FROM campaigns WHERE state='active' ${config.isProd ? 'AND NOT is_test' : ''} LIMIT 1`,
  );
  return rows[0] ?? null;
}

/** Campanha de referência do painel: ativa, senão pausada mais recente. */
export async function getCurrentForStaff(db) {
  const { rows } = await db.query(
    `SELECT * FROM campaigns WHERE state IN ('active','paused') ORDER BY (state='active') DESC, updated_at DESC LIMIT 1`,
  );
  return rows[0] ?? null;
}

const EDITABLE = {
  name: 'name', rewardName: 'reward_name', quantityPerVoucher: 'quantity_per_voucher', rulesText: 'rules_text',
  startsAt: 'starts_at', endsAt: 'ends_at', invitationTtlMinutes: 'invitation_ttl_minutes',
  sessionTtlMinutes: 'session_ttl_minutes', rewardTtlMinutes: 'reward_ttl_minutes',
  minPlayMinutes: 'min_play_minutes', totalStock: 'total_stock',
};
const INT_COLS = new Set(['quantity_per_voucher', 'total_stock', 'invitation_ttl_minutes', 'session_ttl_minutes', 'reward_ttl_minutes', 'min_play_minutes']);
const OFFER_FIELDS = new Set(['reward_name', 'quantity_per_voucher', 'rules_text']);

function cleanInput(input = {}) {
  const out = {};
  for (const [k, col] of Object.entries(EDITABLE)) {
    if (!(k in input)) continue;
    let v = input[k];
    if (v === '') v = null;
    if (INT_COLS.has(col) && v !== null) {
      v = Number(v);
      if (!Number.isInteger(v) || v < 0 || v > 1_000_000) throw err('BAD_REQUEST', { field: k }, `Valor inválido em ${k}.`);
    }
    if ((col === 'starts_at' || col === 'ends_at') && v !== null) {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) throw err('BAD_REQUEST', { field: k }, `Data inválida em ${k}.`);
      v = d.toISOString();
    }
    if (typeof v === 'string') v = v.trim().slice(0, 2000);
    out[col] = v;
  }
  return out;
}

function mapDbError(e) {
  if (e.code === '23514' && e.constraint === 'stock_commitment') return err('STOCK_BELOW_COMMITTED');
  if (e.code === '23514' && e.constraint === 'period_valid') return err('BAD_REQUEST', { field: 'endsAt' }, 'O fim precisa ser depois do início.');
  if (e.code === '23514') return err('BAD_REQUEST', { constraint: e.constraint });
  if (e.code === '23505' && e.constraint === 'campaigns_one_active') return err('ANOTHER_CAMPAIGN_ACTIVE');
  return e;
}

export async function createCampaign(pool, operator, input) {
  const isTest = Boolean(input.isTest);
  if (isTest && config.isProd) throw err('TEST_CAMPAIGN_IN_PRODUCTION');
  const data = cleanInput(input);
  if (!data.name) throw err('BAD_REQUEST', { field: 'name' }, 'Informe o nome da campanha.');
  return tx(pool, async (c) => {
    const cols = ['is_test', 'state', ...Object.keys(data)];
    const vals = [isTest, 'disabled', ...Object.values(data)];
    try {
      const { rows } = await c.query(
        `INSERT INTO campaigns (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, vals);
      await audit(c, 'campaign.created', { operatorId: operator.id, campaignId: rows[0].id, details: { isTest } });
      return rows[0];
    } catch (e) { throw mapDbError(e); }
  });
}

export async function updateCampaign(pool, operator, id, input) {
  const data = cleanInput(input);
  return tx(pool, async (c) => {
    const { rows: [cur] } = await c.query('SELECT * FROM campaigns WHERE id=$1 FOR UPDATE', [id]);
    if (!cur) throw err('CAMPAIGN_NOT_FOUND');
    if (cur.state === 'closed') throw err('INVALID_STATE');
    if (Object.keys(data).length === 0) return cur;
    if ('total_stock' in data && data.total_stock < cur.reserved_count + cur.awarded_count) throw err('STOCK_BELOW_COMMITTED');
    const offerChanged = Object.keys(data).some((k) => OFFER_FIELDS.has(k) && data[k] !== cur[k]);
    const sets = Object.keys(data).map((k, i) => `${k}=$${i + 2}`);
    if (offerChanged) sets.push('rules_version = rules_version + 1');
    sets.push('updated_at=now()');
    try {
      const { rows } = await c.query(`UPDATE campaigns SET ${sets.join(',')} WHERE id=$1 RETURNING *`, [id, ...Object.values(data)]);
      await audit(c, 'campaign.updated', { operatorId: operator.id, campaignId: id, details: { fields: Object.keys(data), offerChanged } });
      return rows[0];
    } catch (e) { throw mapDbError(e); }
  });
}

export function missingForActivation(c) {
  const missing = [];
  if (!c.reward_name) missing.push('rewardName');
  if (!c.quantity_per_voucher) missing.push('quantityPerVoucher');
  if (!c.rules_text) missing.push('rulesText');
  if (!c.starts_at) missing.push('startsAt');
  if (!c.ends_at) missing.push('endsAt');
  if (!(c.total_stock > 0)) missing.push('totalStock');
  if (c.ends_at && new Date(c.ends_at) <= new Date()) missing.push('endsAt (precisa ser futuro)');
  return missing;
}

export async function setCampaignState(pool, operator, id, target) {
  return tx(pool, async (c) => {
    const { rows: [cur] } = await c.query('SELECT * FROM campaigns WHERE id=$1 FOR UPDATE', [id]);
    if (!cur) throw err('CAMPAIGN_NOT_FOUND');
    const allowed = {
      active: ['disabled', 'paused'],
      paused: ['active'],
      closed: ['disabled', 'active', 'paused'],
    }[target];
    if (!allowed?.includes(cur.state)) throw err('INVALID_STATE');
    if (target === 'active') {
      if (cur.is_test && config.isProd) throw err('TEST_CAMPAIGN_IN_PRODUCTION');
      if (!cur.is_test && !config.REAL_CAMPAIGNS_ENABLED) throw err('REAL_CAMPAIGNS_LOCKED');
      const missing = missingForActivation(cur);
      if (missing.length) throw err('CAMPAIGN_INCOMPLETE', { missing }, `Campanha incompleta: ${missing.join(', ')}.`);
    }
    try {
      const { rows } = await c.query('UPDATE campaigns SET state=$2, updated_at=now() WHERE id=$1 RETURNING *', [id, target]);
      await audit(c, `campaign.${target}`, { operatorId: operator.id, campaignId: id });
      return rows[0];
    } catch (e) { throw mapDbError(e); }
  });
}
