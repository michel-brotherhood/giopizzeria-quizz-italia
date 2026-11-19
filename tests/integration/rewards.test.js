import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupEnv, client, createCampaign, invite, key, playAll, checkInvariants } from './helpers.js';
import { sweepExpired } from '../../server/services/expiry.js';

let env; let staff; let camp;
beforeEach(async () => {
  env = await setupEnv();
  camp = await createCampaign(env.pool);
  staff = client(env.base);
  await staff.login('ana');
});
afterEach(async () => {
  const inv = await checkInvariants(env.pool, camp.id);
  expect(inv.ok, JSON.stringify(inv)).toBe(true);
  await env.close();
});

describe('convite e sessão', () => {
  it('mesmo convite em dois dispositivos simultâneos: uma sessão e uma reserva', async () => {
    const { token } = await invite(staff, 'Mesa 7');
    const a = client(env.base); const b = client(env.base);
    const [ra, rb] = await Promise.all([a.post('/api/player/exchange', { token }), b.post('/api/player/exchange', { token })]);
    expect([ra.status, rb.status]).toEqual([200, 200]);
    expect(ra.body.session.id).toBe(rb.body.session.id);
    expect([ra.body.resumed, rb.body.resumed].sort()).toEqual([false, true]);
    const { rows } = await env.pool.query('SELECT count(*)::int n FROM quiz_sessions');
    expect(rows[0].n).toBe(1);
    expect((await checkInvariants(env.pool, camp.id)).counters.reserved).toBe(1);
  });

  it('reemissão para a mesma conta mantém unicidade; recuperação leva à mesma sessão', async () => {
    const first = await invite(staff, 'comanda 42');
    const again = await invite(staff, '  COMANDA   42 ');
    expect(again.kind).toBe('reissued');
    // o link antigo deixa de valer
    expect((await client(env.base).post('/api/player/exchange', { token: first.token })).status).toBe(404);
    const p = client(env.base);
    const r1 = await p.post('/api/player/exchange', { token: again.token });
    expect(r1.status).toBe(200);
    const rec = await invite(staff, 'Comanda 42');
    expect(rec.kind).toBe('recovery');
    const other = client(env.base);
    const r2 = await other.post('/api/player/exchange', { token: rec.token });
    expect(r2.body.session.id).toBe(r1.body.session.id);
    const { rows } = await env.pool.query('SELECT count(*)::int n FROM invitations');
    expect(rows[0].n).toBe(1);
  });

  it('duas criações simultâneas de convite para a mesma conta geram um único convite', async () => {
    const rs = await Promise.all([1, 2, 3].map(() => staff.post('/api/staff/invitations', { accountRef: 'M10' })));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    const { rows } = await env.pool.query('SELECT count(*)::int n FROM invitations');
    expect(rows[0].n).toBe(1);
  });

  it('convite expirado não inicia partida', async () => {
    const { token } = await invite(staff, 'M1');
    await env.pool.query(`UPDATE invitations SET expires_at = now() - interval '1 minute'`);
    const r = await client(env.base).post('/api/player/exchange', { token });
    expect(r.status).toBe(410);
    expect(r.body.error.code).toBe('INVITATION_EXPIRED');
  });

  it('token inválido não revela nada', async () => {
    const r = await client(env.base).post('/api/player/exchange', { token: 'x'.repeat(43) });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('INVITATION_INVALID');
  });
});

describe('estoque', () => {
  it('duas sessões disputam a última unidade: uma reserva, nenhum contador negativo', async () => {
    await env.pool.query('UPDATE campaigns SET total_stock=1 WHERE id=$1', [camp.id]);
    const i1 = await invite(staff, 'A'); const i2 = await invite(staff, 'B');
    const [r1, r2] = await Promise.all([client(env.base).post('/api/player/exchange', { token: i1.token }), client(env.base).post('/api/player/exchange', { token: i2.token })]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect([r1, r2].find((r) => r.status === 409).body.error.code).toBe('OUT_OF_STOCK');
    expect((await checkInvariants(env.pool, camp.id)).counters).toMatchObject({ reserved: 1, awarded: 0 });
  });

  it('20 jogadores disputam 5 unidades: exatamente 5 reservas', async () => {
    await env.pool.query('UPDATE campaigns SET total_stock=5 WHERE id=$1', [camp.id]);
    const invs = [];
    for (let i = 0; i < 20; i++) invs.push(await invite(staff, `C${i}`));
    const rs = await Promise.all(invs.map((i) => client(env.base).post('/api/player/exchange', { token: i.token })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(5);
    expect(rs.filter((r) => r.status === 409 && r.body.error.code === 'OUT_OF_STOCK')).toHaveLength(15);
  });

  it('estoque não pode ser reduzido abaixo do comprometido', async () => {
    const mgr = client(env.base); await mgr.login('gerente');
    const { token } = await invite(staff, 'D');
    await client(env.base).post('/api/player/exchange', { token });
    await env.pool.query('UPDATE campaigns SET total_stock=1 WHERE id=$1', [camp.id]);
    const r = await mgr.patch(`/api/staff/campaigns/${camp.id}`, { totalStock: 0 });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('STOCK_BELOW_COMMITTED');
  });
});

describe('respostas e pontuação', () => {
  async function started() {
    const { token } = await invite(staff, `P${Math.random()}`.slice(0, 12));
    const p = client(env.base);
    const r = await p.post('/api/player/exchange', { token });
    const { rows: [s] } = await env.pool.query('SELECT question_order FROM quiz_sessions WHERE public_id=$1', [r.body.session.id]);
    return { p, order: s.question_order, state: r.body };
  }

  it('não expõe resposta correta antes de responder', async () => {
    const { state } = await started();
    expect(state.session.current.correctOptionId).toBeUndefined();
    expect(JSON.stringify(state)).not.toContain('correctOptionId":"');
    expect(state.session.current.explanation).toBeUndefined();
  });

  it('duplo envio igual devolve estado canônico; alternativa conflitante é recusada sem sobrescrever', async () => {
    const { p, order } = await started();
    const q = order[0];
    const wrong = q.options.find((o) => o.id !== q.correctOptionId).id;
    const k1 = key();
    const [a, b] = await Promise.all([
      p.post('/api/player/session/answer', { questionId: q.id, selectedOptionId: wrong }, { 'idempotency-key': k1 }),
      p.post('/api/player/session/answer', { questionId: q.id, selectedOptionId: wrong }, { 'idempotency-key': k1 }),
    ]);
    expect(a.status).toBe(200); expect(b.status).toBe(200);
    expect(a.body.correct).toBe(false);
    const retry = await p.post('/api/player/session/answer', { questionId: q.id, selectedOptionId: wrong }, { 'idempotency-key': key() });
    expect(retry.body.duplicate).toBe(true);
    const conflict = await p.post('/api/player/session/answer', { questionId: q.id, selectedOptionId: q.correctOptionId }, { 'idempotency-key': key() });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('ANSWER_CONFLICT');
    const sameKeyOtherPayload = await p.post('/api/player/session/answer', { questionId: q.id, selectedOptionId: q.correctOptionId }, { 'idempotency-key': k1 });
    expect(sameKeyOtherPayload.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    const st = await p.get('/api/player/session');
    expect(st.body.session.score).toBe(0);
    expect(st.body.session.answered[0].selectedOptionId).toBe(wrong);
  });

  it('pergunta fora de ordem e alternativa inexistente são recusadas', async () => {
    const { p, order } = await started();
    const r = await p.post('/api/player/session/answer', { questionId: order[3].id, selectedOptionId: order[3].correctOptionId }, { 'idempotency-key': key() });
    expect(r.body.error.code).toBe('QUESTION_OUT_OF_ORDER');
    const r2 = await p.post('/api/player/session/answer', { questionId: order[0].id, selectedOptionId: 'zz' }, { 'idempotency-key': key() });
    expect(r2.body.error.code).toBe('INVALID_OPTION');
    const r3 = await p.post('/api/player/session/answer', { questionId: order[0].id, selectedOptionId: order[0].correctOptionId });
    expect(r3.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  for (const n of [0, 1, 7, 8]) {
    it(`pontuação com ${n} acertos = ${n * 100} e o brinde não depende da nota`, async () => {
      const { p } = await started();
      await playAll(p, env.pool, n);
      const c = await p.post('/api/player/session/complete', {}, { 'idempotency-key': key() });
      expect(c.status).toBe(200);
      expect(c.body.session.score).toBe(n * 100);
      expect(c.body.voucher.state).toBe('issued');
    });
  }

  it('cliente enviando score/eligible/voucherValid não altera nada', async () => {
    const { p, order } = await started();
    const q = order[0];
    const wrong = q.options.find((o) => o.id !== q.correctOptionId).id;
    const r = await p.post('/api/player/session/answer', { questionId: q.id, selectedOptionId: wrong, score: 800, eligible: true, voucherValid: true, isCorrect: true }, { 'idempotency-key': key() });
    expect(r.body.correct).toBe(false);
    expect(r.body.score).toBe(0);
    const c = await p.post('/api/player/session/complete', { score: 800, eligible: true }, { 'idempotency-key': key() });
    expect(c.body.error.code).toBe('SESSION_INCOMPLETE');
  });
});

describe('conclusão e voucher', () => {
  async function finished() {
    const { token } = await invite(staff, `F${Math.random()}`.slice(0, 12));
    const p = client(env.base);
    await p.post('/api/player/exchange', { token });
    await playAll(p, env.pool, 5);
    return p;
  }

  it('cinco pedidos de conclusão simultâneos (e com chaves diferentes) geram um voucher e uma conversão', async () => {
    const p = await finished();
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => p.post('/api/player/session/complete', {}, { 'idempotency-key': key() })));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    const codes = new Set(rs.map((r) => r.body.voucher.code));
    expect(codes.size).toBe(1);
    const { rows } = await env.pool.query('SELECT count(*)::int n FROM vouchers');
    expect(rows[0].n).toBe(1);
    expect((await checkInvariants(env.pool, camp.id)).counters).toMatchObject({ reserved: 0, awarded: 1 });
  });

  it('repetição após "timeout" com a mesma chave devolve o mesmo voucher', async () => {
    const p = await finished();
    const k1 = key();
    const a = await p.post('/api/player/session/complete', {}, { 'idempotency-key': k1 });
    const b = await p.post('/api/player/session/complete', {}, { 'idempotency-key': k1 });
    expect(a.body.voucher.code).toBe(b.body.voucher.code);
  });

  it('completar e expirar simultaneamente: um estado terminal coerente', async () => {
    for (let i = 0; i < 6; i++) {
      const p = await finished();
      await env.pool.query(`UPDATE quiz_sessions SET expires_at = now() + interval '30 milliseconds' WHERE state='active'`);
      await new Promise((r) => setTimeout(r, 15 + i * 5));
      const [c] = await Promise.all([
        p.post('/api/player/session/complete', {}, { 'idempotency-key': key() }),
        sweepExpired(env.pool),
        sweepExpired(env.pool),
      ]);
      expect([200, 410]).toContain(c.status);
      const inv = await checkInvariants(env.pool, camp.id);
      expect(inv.ok, JSON.stringify(inv)).toBe(true);
      expect(inv.counters.reserved).toBe(0);
    }
    const { rows } = await env.pool.query(`SELECT state, reservation_state FROM quiz_sessions`);
    for (const r of rows) expect(['completed:converted', 'expired:released']).toContain(`${r.state}:${r.reservation_state}`);
  });

  it('sessão expirada libera a reserva uma única vez e não emite voucher', async () => {
    const p = await finished();
    await env.pool.query(`UPDATE quiz_sessions SET expires_at = now() - interval '1 second'`);
    await Promise.all([sweepExpired(env.pool), sweepExpired(env.pool), p.get('/api/player/session')]);
    const c = await p.post('/api/player/session/complete', {}, { 'idempotency-key': key() });
    expect(c.body.error.code).toBe('SESSION_EXPIRED');
    expect((await checkInvariants(env.pool, camp.id)).counters).toMatchObject({ reserved: 0, awarded: 0 });
  });

  it('credencial do voucher ilegível (troca de segredo) não derruba a sessão do cliente', async () => {
    const p = await finished();
    await p.post('/api/player/session/complete', {}, { 'idempotency-key': key() });
    await env.pool.query(`UPDATE vouchers SET token_enc='xx.yy.zz'`);
    const st = await p.get('/api/player/session');
    expect(st.status).toBe(200);
    expect(st.body.voucher.state).toBe('issued');
    expect(st.body.voucher.credentialUnavailable).toBe(true);
    expect(st.body.voucher.code).toBeUndefined();
  });

  it('recarregar mantém o voucher (estado canônico do servidor)', async () => {
    const p = await finished();
    const c = await p.post('/api/player/session/complete', {}, { 'idempotency-key': key() });
    const again = await p.get('/api/player/session');
    expect(again.body.voucher.code).toBe(c.body.voucher.code);
    expect(again.body.voucher.isTest).toBe(true);
  });
});

describe('resgate pela equipe', () => {
  async function voucher() {
    const { token } = await invite(staff, `V${Math.random()}`.slice(0, 12));
    const p = client(env.base);
    await p.post('/api/player/exchange', { token });
    await playAll(p, env.pool, 8);
    const c = await p.post('/api/player/session/complete', {}, { 'idempotency-key': key() });
    return { p, code: c.body.voucher.code, qrUrl: c.body.voucher.qrSvg };
  }

  it('consulta não consome; dois operadores confirmam ao mesmo tempo: uma entrega', async () => {
    const { code, p } = await voucher();
    const l = await staff.post('/api/staff/vouchers/lookup', { code });
    expect(l.body.voucher.state).toBe('issued');
    expect(l.body.voucher.accountRefHint).toMatch(/^•/);
    const l2 = await staff.post('/api/staff/vouchers/lookup', { code: code.toLowerCase().replace('-', ' ') });
    expect(l2.body.voucher.state).toBe('issued');
    const bruno = client(env.base); await bruno.login('bruno');
    const [a, b] = await Promise.all([
      staff.post('/api/staff/vouchers/redeem', { code }, { 'idempotency-key': key() }),
      bruno.post('/api/staff/vouchers/redeem', { code }, { 'idempotency-key': key() }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect([a, b].find((r) => r.status === 409).body.error.code).toBe('ALREADY_REDEEMED');
    expect((await checkInvariants(env.pool, camp.id)).counters).toMatchObject({ awarded: 1, redeemed: 1 });
    const st = await p.get('/api/player/session');
    expect(st.body.voucher.state).toBe('redeemed');
    expect(st.body.voucher.redeemedAt).toBeTruthy();
    expect(st.body.voucher.code).toBeUndefined();
  });

  it('retry do mesmo operador com a mesma chave não gera segunda entrega', async () => {
    const { code } = await voucher();
    const k1 = key();
    const a = await staff.post('/api/staff/vouchers/redeem', { code }, { 'idempotency-key': k1 });
    const b = await staff.post('/api/staff/vouchers/redeem', { code }, { 'idempotency-key': k1 });
    expect(a.status).toBe(200); expect(b.status).toBe(200);
    expect(b.body.voucher.state).toBe('redeemed');
    expect((await checkInvariants(env.pool, camp.id)).counters.redeemed).toBe(1);
  });

  it('voucher expirado: devolve unidade uma vez e recusa entrega', async () => {
    const { code } = await voucher();
    await env.pool.query(`UPDATE vouchers SET expires_at = now() - interval '1 second'`);
    const [r] = await Promise.all([
      staff.post('/api/staff/vouchers/redeem', { code }, { 'idempotency-key': key() }),
      sweepExpired(env.pool),
    ]);
    expect(r.status).toBe(410);
    expect(r.body.error.code).toBe('VOUCHER_EXPIRED');
    expect((await checkInvariants(env.pool, camp.id)).counters).toMatchObject({ awarded: 0, redeemed: 0 });
  });

  it('voucher entregue não volta ao estoque nem expira', async () => {
    const { code } = await voucher();
    await staff.post('/api/staff/vouchers/redeem', { code }, { 'idempotency-key': key() });
    await env.pool.query(`UPDATE vouchers SET expires_at = now() - interval '1 second'`);
    await sweepExpired(env.pool);
    const l = await staff.post('/api/staff/vouchers/lookup', { code });
    expect(l.body.voucher.state).toBe('redeemed');
    expect((await checkInvariants(env.pool, camp.id)).counters).toMatchObject({ awarded: 1, redeemed: 1 });
  });

  it('URL do QR também funciona na consulta (token no fragmento)', async () => {
    const { p } = await voucher();
    const { rows: [v] } = await env.pool.query('SELECT token_enc FROM vouchers');
    const { decrypt } = await import('../../server/services/crypto.js');
    const { token } = decrypt(v.token_enc);
    const l = await staff.post('/api/staff/vouchers/lookup', { code: `http://test.local/equipe/#v=${token}` });
    expect(l.body.voucher.state).toBe('issued');
    expect(p).toBeTruthy();
  });

  it('nenhuma rota GET confirma entrega', async () => {
    const { code } = await voucher();
    for (const path of ['/api/staff/vouchers/redeem', `/api/staff/vouchers/redeem?code=${code}`, '/api/player/voucher', '/api/staff/overview']) {
      await staff.get(path);
    }
    const l = await staff.post('/api/staff/vouchers/lookup', { code });
    expect(l.body.voucher.state).toBe('issued');
  });
});

describe('campanha', () => {
  it('pausa bloqueia novos inícios e preserva sessões e vouchers ativos', async () => {
    const mgr = client(env.base); await mgr.login('gerente');
    const i1 = await invite(staff, 'Antes');
    const i2 = await invite(staff, 'Depois');
    const p = client(env.base);
    await p.post('/api/player/exchange', { token: i1.token });
    expect((await mgr.post(`/api/staff/campaigns/${camp.id}/pause`)).status).toBe(200);
    const blocked = await client(env.base).post('/api/player/exchange', { token: i2.token });
    expect(blocked.body.error.code).toBe('CAMPAIGN_PAUSED');
    expect((await staff.post('/api/staff/invitations', { accountRef: 'Nova' })).body.error.code).toBe('CAMPAIGN_PAUSED');
    await playAll(p, env.pool, 3);
    const c = await p.post('/api/player/session/complete', {}, { 'idempotency-key': key() });
    expect(c.body.voucher.state).toBe('issued');
    const r = await staff.post('/api/staff/vouchers/redeem', { code: c.body.voucher.code }, { 'idempotency-key': key() });
    expect(r.status).toBe(200);
  });

  it('edição da oferta não altera snapshot de voucher emitido', async () => {
    const mgr = client(env.base); await mgr.login('gerente');
    const { token } = await invite(staff, 'Snap');
    const p = client(env.base);
    await p.post('/api/player/exchange', { token });
    await playAll(p, env.pool, 8);
    const c = await p.post('/api/player/session/complete', {}, { 'idempotency-key': key() });
    const u = await mgr.patch(`/api/staff/campaigns/${camp.id}`, { rewardName: 'Outro nome de teste' });
    expect(u.body.campaign.rulesVersion).toBe(2);
    const st = await p.get('/api/player/session');
    expect(st.body.voucher.rewardName).toBe(c.body.voucher.rewardName);
  });

  it('campanha real não ativa sem REAL_CAMPAIGNS_ENABLED; incompleta é recusada', async () => {
    const mgr = client(env.base); await mgr.login('gerente');
    const created = await mgr.post('/api/staff/campaigns', { name: 'Campanha real futura' });
    expect(created.status).toBe(201);
    expect(created.body.campaign.state).toBe('disabled');
    const a = await mgr.post(`/api/staff/campaigns/${created.body.campaign.id}/activate`);
    expect(a.body.error.code).toBe('REAL_CAMPAIGNS_LOCKED');
    const t = await mgr.post('/api/staff/campaigns', { name: 'Teste incompleto', isTest: true });
    const a2 = await mgr.post(`/api/staff/campaigns/${t.body.campaign.id}/activate`);
    expect(a2.body.error.code).toBe('CAMPAIGN_INCOMPLETE');
  });

  it('sem campanha ativa: modo demo público', async () => {
    await env.pool.query(`UPDATE campaigns SET state='disabled'`);
    const r = await client(env.base).get('/api/campaign/current');
    expect(r.body).toEqual({ mode: 'demo', campaign: null });
  });
});

describe('segurança de rotas', () => {
  it('cliente sem login não acessa rotas da equipe', async () => {
    const anon = client(env.base);
    expect((await anon.post('/api/staff/invitations', { accountRef: 'x' })).status).toBe(401);
    expect((await anon.post('/api/staff/vouchers/lookup', { code: 'x' })).status).toBe(401);
    expect((await anon.get('/api/staff/overview')).status).toBe(401);
  });

  it('atendente não gerencia campanha; mutação sem CSRF é recusada', async () => {
    expect((await staff.get('/api/staff/campaigns')).status).toBe(403);
    expect((await staff.post(`/api/staff/campaigns/${camp.id}/pause`)).status).toBe(403);
    staff.setCsrf('errado');
    expect((await staff.post('/api/staff/invitations', { accountRef: 'x' })).body.error.code).toBe('CSRF_FAILED');
  });

  it('POST de outra origem é recusado', async () => {
    const r = await staff.post('/api/staff/invitations', { accountRef: 'x' }, { origin: 'https://evil.example' });
    expect(r.status).toBe(403);
  });

  it('login errado não diferencia usuário inexistente', async () => {
    const a = await client(env.base).login('ana', 'errada');
    const b = await client(env.base).login('ninguem', 'errada');
    expect(a.status).toBe(401); expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });

  it('jogador sem cookie não consulta sessão', async () => {
    const r = await client(env.base).get('/api/player/session');
    expect(r.body.error.code).toBe('SESSION_REQUIRED');
  });
});
