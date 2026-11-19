// Partidas sem brinde guardadas no cadastro: o servidor recorrige, é idempotente, valida a rodada
// e o painel do gerente mostra estatísticas, busca e perguntas mais erradas.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupEnv, client, createCampaign, invite, playAll } from './helpers.js';
import { QUESTIONS } from '../../server/services/content.js';
import { drawRound, seededRng } from '../../shared/quiz.js';

let env;
beforeEach(async () => { env = await setupEnv(); });
afterEach(async () => { await env.close(); });

let seq = 0;
async function registered(over = {}) {
  const c = client(env.base);
  const n = seq++;
  const r = await c.post('/api/register', { name: `Pessoa ${n}`, email: `pessoa${n}@teste.local`, phone: `21 98888-${String(1000 + n)}`, acceptPrivacy: true, ...over });
  expect(r.status).toBe(201);
  return c;
}

/** Rodada válida com `right` acertos; as erradas escolhem a primeira alternativa incorreta. */
function play(seed, right, playId = `play-${seed}-${right}-xxxxxxxxxx`) {
  const round = drawRound(QUESTIONS, seededRng(seed));
  return {
    playId,
    answers: round.map((q, i) => ({
      questionId: q.id,
      selectedOptionId: i < right ? q.correctOptionId : q.options.find((o) => o.id !== q.correctOptionId).id,
    })),
    round,
  };
}

describe('partidas sem brinde no cadastro', () => {
  it('exige cadastro, recorrige no servidor e é idempotente', async () => {
    const anon = client(env.base, { register: false });
    const p = play(1, 5);
    expect((await anon.post('/api/play/result', p)).body.error.code).toBe('REGISTRATION_REQUIRED');

    const c = await registered();
    const r1 = await c.post('/api/play/result', { playId: p.playId, answers: p.answers, correct: 8, score: 800 });
    expect(r1.status).toBe(200);
    expect(r1.body).toMatchObject({ saved: true, correct: 5 }); // ignora "correct"/"score" enviados
    const r2 = await c.post('/api/play/result', { playId: p.playId, answers: p.answers });
    expect(r2.body).toMatchObject({ saved: true, correct: 5, duplicate: true });
    const { rows } = await env.pool.query('SELECT correct, answers FROM free_plays');
    expect(rows.length).toBe(1);
    expect(rows[0].answers.filter((a) => a.correct).length).toBe(5);
    expect((await env.pool.query('SELECT count(*)::int n FROM vouchers')).rows[0].n).toBe(0);
  });

  it('rejeita rodadas malformadas', async () => {
    const c = await registered();
    const p = play(2, 3);
    const bad = [
      { ...p, playId: 'curto' },
      { ...p, answers: p.answers.slice(0, 7) },
      { ...p, answers: [p.answers[0], ...p.answers.slice(0, 7)] },                         // pergunta repetida
      { ...p, answers: [p.answers[1], p.answers[0], ...p.answers.slice(2)] },              // fora do padrão de categorias
      { ...p, answers: p.answers.map((a, i) => (i ? a : { ...a, selectedOptionId: 'zz' })) },
      { ...p, answers: p.answers.map((a, i) => (i ? a : { ...a, questionId: 'nao-existe' })) },
    ];
    for (const b of bad) expect((await c.post('/api/play/result', b)).status).toBe(400);
    expect((await env.pool.query('SELECT count(*)::int n FROM free_plays')).rows[0].n).toBe(0);
  });

  it('painel: totais, distribuição, perguntas mais erradas, busca, filtro e CSV; só gerente', async () => {
    const ana = await registered({ name: 'Ana Lima', email: 'ana.lima@teste.local', phone: '21 97777-1234', marketingConsent: true });
    const bia = await registered({ name: 'Bia Costa', email: 'bia@teste.local', phone: '21 96666-5678' });
    await registered({ name: 'Caio Sem Partida', email: 'caio@teste.local', phone: '21 95555-0000' });
    await ana.post('/api/play/result', play(3, 8));
    await ana.post('/api/play/result', play(4, 6));
    await bia.post('/api/play/result', play(5, 2));

    // partida com brinde também conta
    const camp = await createCampaign(env.pool);
    const staff = client(env.base); await staff.login('ana');
    const inv = await invite(staff, 'MESA 9');
    const player = client(env.base);
    expect((await player.post('/api/player/exchange', { token: inv.token })).status).toBe(200);
    await playAll(player, env.pool, 7);
    expect((await player.post('/api/player/session/complete', {}, { 'idempotency-key': 'complete-key-0001' })).status).toBe(200);

    expect((await staff.get('/api/staff/registrations')).status).toBe(403);
    const mgr = client(env.base); await mgr.login('gerente');
    const s = (await mgr.get('/api/staff/registrations')).body;
    expect(s).toMatchObject({ total: 4, marketing: 1, plays: 4, players: 3, highScores: 2, matched: 4, page: 1, pages: 1 });
    expect(s.avgCorrect).toBeCloseTo((8 + 6 + 2 + 7) / 4, 1);
    expect(s.distribution).toEqual([0, 0, 1, 0, 0, 0, 1, 1, 1]);
    expect(s.questions.length).toBeGreaterThan(0);
    for (let i = 1; i < s.questions.length; i++) expect(s.questions[i].rate).toBeGreaterThanOrEqual(s.questions[i - 1].rate);
    const anaRow = s.recent.find((x) => x.email === 'ana.lima@teste.local');
    expect(anaRow).toMatchObject({ plays: 2, best: 8, avg: 7 });
    expect(s.recent.find((x) => x.email === 'caio@teste.local')).toMatchObject({ plays: 0, best: null });

    expect((await mgr.get('/api/staff/registrations?q=lima')).body.recent.map((x) => x.name)).toEqual(['Ana Lima']);
    expect((await mgr.get('/api/staff/registrations?q=6666')).body.recent.map((x) => x.name)).toEqual(['Bia Costa']);
    expect((await mgr.get('/api/staff/registrations?marketing=1')).body.matched).toBe(1);
    expect((await mgr.get('/api/staff/registrations?q=%25')).body.matched).toBe(0); // % é literal

    const res = await fetch(`${env.base}/api/staff/registrations.csv`, { headers: { cookie: [...mgr.jar].map(([k, v]) => `${k}=${v}`).join('; ') } });
    const csv = await res.text();
    expect(csv.split('\r\n')[0]).toContain('"partidas","melhor_acerto_de_8"'.replace(/"/g, ''));
    expect(csv).toMatch(/"ana\.lima@teste\.local".*"2","8","7"/);
    expect(camp).toBeTruthy();
  });

  it('excluir o cadastro apaga as partidas sem brinde dele', async () => {
    const c = await registered({ email: 'apagar@teste.local' });
    await c.post('/api/play/result', play(6, 4));
    const mgr = client(env.base); await mgr.login('gerente');
    expect((await mgr.post('/api/staff/registrations/delete', { email: 'apagar@teste.local' })).body.deleted).toBe(true);
    expect((await env.pool.query('SELECT count(*)::int n FROM free_plays')).rows[0].n).toBe(0);
  });
});
