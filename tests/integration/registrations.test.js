// Cadastro obrigatório (LGPD): validação, aceite da política, promoções opcionais, vínculo com a partida,
// exportação e exclusão restritas ao gerente.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupEnv, client, createCampaign, invite } from './helpers.js';

let env;
beforeEach(async () => { env = await setupEnv(); });
afterEach(async () => { await env.close(); });

const valid = (over = {}) => ({ name: '  Ana   Souza ', email: 'Ana@Exemplo.com', phone: '(21) 99876-5432', acceptPrivacy: true, ...over });

describe('cadastro', () => {
  it('sem cadastro não troca convite; com cadastro troca e a partida fica ligada ao cadastro', async () => {
    await createCampaign(env.pool);
    const staff = client(env.base); await staff.login('ana');
    const inv = await invite(staff, 'MESA 1');
    const anon = client(env.base, { register: false });
    const r0 = await anon.post('/api/player/exchange', { token: inv.token });
    expect(r0.status).toBe(401);
    expect(r0.body.error.code).toBe('REGISTRATION_REQUIRED');
    expect((await anon.get('/api/register/me')).body.registered).toBe(false);
    const reg = await anon.post('/api/register', valid());
    expect(reg.status).toBe(201);
    expect(reg.body.firstName).toBe('Ana');
    expect((await anon.get('/api/register/me')).body).toMatchObject({ registered: true, firstName: 'Ana' });
    expect((await anon.post('/api/player/exchange', { token: inv.token })).status).toBe(200);
    const { rows: [s] } = await env.pool.query('SELECT registration_id FROM quiz_sessions');
    const { rows: [r] } = await env.pool.query('SELECT * FROM registrations');
    expect(s.registration_id).toBe(r.id);
    expect(r).toMatchObject({ name: 'Ana Souza', email: 'ana@exemplo.com', phone: '5521998765432', marketing_consent: false, marketing_consent_at: null });
  });

  it('valida campos e exige aceite da política', async () => {
    const c = client(env.base);
    const r = await c.post('/api/register', { name: 'A', email: 'x@', phone: '123', acceptPrivacy: false });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.error.details.fields).sort()).toEqual(['acceptPrivacy', 'email', 'name', 'phone']);
    expect((await env.pool.query('SELECT count(*)::int n FROM registrations')).rows[0].n).toBe(0);
  });

  it('promoções: opcional, registra data do aceite e permite revogar; mesmo e-mail atualiza', async () => {
    const c = client(env.base);
    await c.post('/api/register', valid({ marketingConsent: true }));
    let { rows: [r] } = await env.pool.query('SELECT * FROM registrations');
    expect(r.marketing_consent).toBe(true);
    expect(r.marketing_consent_at).not.toBeNull();
    await client(env.base).post('/api/register', valid({ email: 'ANA@exemplo.com', phone: '21 3333-4444', marketingConsent: false }));
    const all = (await env.pool.query('SELECT * FROM registrations')).rows;
    expect(all.length).toBe(1);
    expect(all[0]).toMatchObject({ phone: '552133334444', marketing_consent: false, marketing_consent_at: null });
  });

  it('exportação e exclusão: só gerente; CSV neutraliza fórmulas; auditoria sem dados pessoais', async () => {
    await client(env.base).post('/api/register', valid({ name: '=HYPERLINK("x")', marketingConsent: true }));
    const att = client(env.base); await att.login('ana');
    expect((await att.get('/api/staff/registrations')).status).toBe(403);
    expect((await att.get('/api/staff/registrations.csv')).status).toBe(403);
    const mgr = client(env.base); await mgr.login('gerente');
    const sum = await mgr.get('/api/staff/registrations');
    expect(sum.body).toMatchObject({ total: 1, marketing: 1 });
    const res = await fetch(`${env.base}/api/staff/registrations.csv`, { headers: { cookie: [...mgr.jar].map(([k, v]) => `${k}=${v}`).join('; ') } });
    expect(res.headers.get('content-type')).toContain('text/csv');
    const csv = await res.text();
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
    expect(csv).toContain('"ana@exemplo.com"');
    expect((await att.post('/api/staff/registrations/delete', { email: 'ana@exemplo.com' })).status).toBe(403);
    expect((await mgr.post('/api/staff/registrations/delete', { email: 'ANA@exemplo.com' })).body.deleted).toBe(true);
    expect((await env.pool.query('SELECT count(*)::int n FROM registrations')).rows[0].n).toBe(0);
    expect((await mgr.post('/api/staff/registrations/delete', { email: 'ana@exemplo.com' })).status).toBe(404);
    const { rows } = await env.pool.query("SELECT details::text d FROM audit_events WHERE event LIKE 'registration.%'");
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const r of rows) expect(r.d).not.toMatch(/ana@|exemplo|HYPERLINK|99876/i);
  });

  it('cadastro exige mesma origem', async () => {
    const r = await fetch(`${env.base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify(valid()) });
    expect(r.status).toBe(403);
  });
});
