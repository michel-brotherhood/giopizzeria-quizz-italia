// Regras de premiação: pontuação mínima e "a cada N qualificadas", decididas no servidor,
// com devolução da reserva para quem não ganha e contagem sem corrida sob concorrência.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupEnv, client, createCampaign, invite, key, playAll, checkInvariants } from './helpers.js';

let env, staff;
beforeEach(async () => { env = await setupEnv(); staff = client(env.base); await staff.login('ana'); });
afterEach(async () => { await env.close(); });

let ref = 0;
async function playOne(correct) {
  const inv = await invite(staff, `CONTA ${ref++}`);
  const p = client(env.base);
  expect((await p.post('/api/player/exchange', { token: inv.token })).status).toBe(200);
  await playAll(p, env.pool, correct);
  return p;
}
const complete = (p) => p.post('/api/player/session/complete', {}, { 'idempotency-key': key() });

describe('pontuação mínima', () => {
  it('abaixo da meta não ganha e devolve a reserva; na meta ganha', async () => {
    const camp = await createCampaign(env.pool, { award_rule: 'min_score', min_correct: 7, total_stock: 5 });
    const low = await playOne(6);
    const r1 = await complete(low);
    expect(r1.status).toBe(200);
    expect(r1.body.voucher).toBeNull();
    expect(r1.body.session).toMatchObject({ state: 'completed', awardOutcome: 'not_qualified', score: 600 });
    expect(r1.body.session.campaign).toMatchObject({ awardRule: 'min_score', minCorrect: 7 });
    // repetir a conclusão não muda nada
    expect((await complete(low)).body.session.awardOutcome).toBe('not_qualified');
    const high = await playOne(7);
    const r2 = await complete(high);
    expect(r2.body.voucher.state).toBe('issued');
    expect(r2.body.session.awardOutcome).toBe('awarded');
    const inv = await checkInvariants(env.pool, camp.id);
    expect(inv.ok).toBe(true);
    expect(inv.counters).toMatchObject({ reserved: 0, awarded: 1 });
  });
});

describe('a cada N partidas qualificadas', () => {
  it('só a N-ésima qualificada ganha; não qualificadas não contam', async () => {
    const camp = await createCampaign(env.pool, { award_rule: 'every_n', min_correct: 7, every_n: 3, total_stock: 10 });
    const seq = [8, 5, 7, 8, 2, 7, 8, 7]; // qualificadas: 1ª(8) 2ª(7) 3ª(8)★ 4ª(7) 5ª(8) 6ª(7)★
    const outcomes = [];
    for (const c of seq) outcomes.push((await complete(await playOne(c))).body.session.awardOutcome);
    expect(outcomes).toEqual(['qualified_no_prize', 'not_qualified', 'qualified_no_prize', 'awarded', 'not_qualified',
      'qualified_no_prize', 'qualified_no_prize', 'awarded']);
    const { rows: [c] } = await env.pool.query('SELECT qualified_count, awarded_count, reserved_count FROM campaigns WHERE id=$1', [camp.id]);
    expect(c).toEqual({ qualified_count: 6, awarded_count: 2, reserved_count: 0 });
    expect((await checkInvariants(env.pool, camp.id)).ok).toBe(true);
  });

  it('20 partidas qualificadas concluindo ao mesmo tempo (N=5): exatamente 4 vouchers, sem contagem duplicada', async () => {
    const camp = await createCampaign(env.pool, { award_rule: 'every_n', min_correct: 7, every_n: 5, total_stock: 30 });
    const players = [];
    for (let i = 0; i < 20; i++) players.push(await playOne(8));
    const rs = await Promise.all(players.map(complete));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(rs.filter((r) => r.body.voucher).length).toBe(4);
    const { rows: [c] } = await env.pool.query('SELECT qualified_count, awarded_count FROM campaigns WHERE id=$1', [camp.id]);
    expect(c).toEqual({ qualified_count: 20, awarded_count: 4 });
    expect((await checkInvariants(env.pool, camp.id)).ok).toBe(true);
  });
});

describe('configuração', () => {
  it('regra não muda com a campanha ativa; pausada muda e gera nova versão das regras', async () => {
    const camp = await createCampaign(env.pool, { award_rule: 'min_score', min_correct: 7 });
    const mgr = client(env.base); await mgr.login('gerente');
    const r1 = await mgr.patch(`/api/staff/campaigns/${camp.id}`, { everyN: 10, awardRule: 'every_n' });
    expect(r1.status).toBe(409);
    expect(r1.body.error.code).toBe('AWARD_RULE_LOCKED');
    expect((await mgr.post(`/api/staff/campaigns/${camp.id}/pause`)).status).toBe(200);
    const r2 = await mgr.patch(`/api/staff/campaigns/${camp.id}`, { awardRule: 'every_n', everyN: 10, minCorrect: 6 });
    expect(r2.status).toBe(200);
    expect(r2.body.campaign).toMatchObject({ awardRule: 'every_n', everyN: 10, minCorrect: 6, rulesVersion: 2 });
    expect((await mgr.patch(`/api/staff/campaigns/${camp.id}`, { awardRule: 'sorteio' })).status).toBe(400);
    expect((await mgr.patch(`/api/staff/campaigns/${camp.id}`, { minCorrect: 9 })).status).toBe(400);
  });

  it('cliente não consegue forçar o prêmio enviando pontuação', async () => {
    await createCampaign(env.pool, { award_rule: 'min_score', min_correct: 8 });
    const p = await playOne(3);
    const r = await p.post('/api/player/session/complete', { score: 800, correct: 8, awardOutcome: 'awarded' }, { 'idempotency-key': key() });
    expect(r.body.voucher).toBeNull();
    expect(r.body.session.awardOutcome).toBe('not_qualified');
  });
});
