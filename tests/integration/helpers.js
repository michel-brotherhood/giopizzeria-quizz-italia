import { createPool } from '../../server/db/pool.js';
import { migrate } from '../../server/db/migrate.js';
import { createApp } from '../../server/app.js';
import { hashPassword } from '../../server/services/crypto.js';

export async function setupEnv() {
  const pool = createPool(process.env.DATABASE_URL, 30);
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(pool, () => {});
  const app = createApp(pool, { log: () => {}, serveStatic: false });
  const server = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const pw = await hashPassword('senha-de-teste-123');
  await pool.query(`INSERT INTO operators (username, display_name, role, password_hash) VALUES
    ('gerente','Gerente','manager',$1), ('ana','Ana','attendant',$1), ('bruno','Bruno','attendant',$1)`, [pw]);
  return {
    pool, base,
    async close() { await new Promise((r) => server.close(r)); await pool.end(); },
  };
}

/** Cliente HTTP com cookie jar mínimo (simula um navegador/dispositivo). */
export function client(base) {
  const jar = new Map();
  let csrf = null;
  async function call(method, path, body, headers = {}) {
    const h = { ...headers };
    if (body !== undefined) h['content-type'] = 'application/json';
    if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (csrf && method !== 'GET') h['x-csrf-token'] = csrf;
    const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      const k = kv.slice(0, i); const v = kv.slice(i + 1);
      if (v === '' || /Expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(k); else jar.set(k, v);
    }
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
  }
  return {
    jar,
    get: (p, h) => call('GET', p, undefined, h),
    post: (p, b = {}, h) => call('POST', p, b, h),
    patch: (p, b = {}, h) => call('PATCH', p, b, h),
    async login(username, password = 'senha-de-teste-123') {
      const r = await call('POST', '/api/staff/login', { username, password });
      csrf = r.body?.csrfToken;
      return r;
    },
    setCsrf(v) { csrf = v; },
  };
}

export async function createCampaign(pool, over = {}) {
  const c = {
    name: '[TESTE] integração', is_test: true, state: 'active', reward_name: 'DEMONSTRAÇÃO — SEM VALOR DE RESGATE',
    quantity_per_voucher: 1, rules_text: 'Teste', total_stock: 10,
    starts_at: new Date(Date.now() - 3600_000).toISOString(), ends_at: new Date(Date.now() + 86400_000).toISOString(),
    ...over,
  };
  const cols = Object.keys(c);
  const { rows: [row] } = await pool.query(
    `INSERT INTO campaigns (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, Object.values(c));
  return row;
}

export const tokenFromUrl = (url) => url.split('#convite=')[1];

export async function invite(staffClient, accountRef) {
  const r = await staffClient.post('/api/staff/invitations', { accountRef });
  if (r.status !== 200) throw new Error(`convite falhou: ${r.status} ${JSON.stringify(r.body)}`);
  return { ...r.body, token: tokenFromUrl(r.body.url) };
}

let k = 0;
export const key = () => `k${Date.now().toString(36)}${(k++).toString(36)}xxxx`;

/** Responde todas as perguntas; `correctCount` define quantas acertar (primeiras N). */
export async function playAll(player, pool, correctCount = 8) {
  const state = await player.get('/api/player/session');
  const { rows: [s] } = await pool.query('SELECT question_order FROM quiz_sessions WHERE public_id=$1', [state.body.session.id]);
  let i = 0;
  for (const q of s.question_order.slice(state.body.session.answeredCount)) {
    const wrong = q.options.find((o) => o.id !== q.correctOptionId).id;
    const r = await player.post('/api/player/session/answer', { questionId: q.id, selectedOptionId: i < correctCount ? q.correctOptionId : wrong }, { 'idempotency-key': key() });
    if (r.status !== 200) throw new Error(`resposta falhou ${r.status} ${JSON.stringify(r.body)}`);
    i++;
  }
  return s.question_order;
}

/** Invariantes contábeis da campanha, conferidas contra as linhas reais. */
export async function checkInvariants(pool, campaignId) {
  const { rows: [c] } = await pool.query('SELECT * FROM campaigns WHERE id=$1', [campaignId]);
  const { rows: [n] } = await pool.query(`SELECT
     (SELECT count(*)::int FROM quiz_sessions WHERE campaign_id=$1 AND reservation_state='reserved') AS reserved,
     (SELECT count(*)::int FROM vouchers WHERE campaign_id=$1 AND state IN ('issued','redeemed')) AS awarded,
     (SELECT count(*)::int FROM vouchers WHERE campaign_id=$1 AND state='redeemed') AS redeemed`, [campaignId]);
  return {
    ok: c.reserved_count === n.reserved && c.awarded_count === n.awarded && c.redeemed_count === n.redeemed
      && c.redeemed_count <= c.awarded_count && c.reserved_count + c.awarded_count <= c.total_stock
      && c.reserved_count >= 0 && c.awarded_count >= 0,
    counters: { reserved: c.reserved_count, awarded: c.awarded_count, redeemed: c.redeemed_count, total: c.total_stock },
    rows: n,
  };
}
