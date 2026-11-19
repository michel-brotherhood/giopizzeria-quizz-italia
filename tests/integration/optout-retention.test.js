// Descadastro de promoções por link pessoal, origem do cadastro e apagamento de cadastros inativos.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupEnv, client } from './helpers.js';
import { purgeInactive } from '../../server/services/registrations.js';

let env;
beforeEach(async () => { env = await setupEnv(); });
afterEach(async () => { await env.close(); });

const reg = (over = {}) => client(env.base).post('/api/register',
  { name: 'Lia Mota', email: 'lia@teste.local', phone: '21 97777-0001', acceptPrivacy: true, marketingConsent: true, ...over });

describe('descadastro, origem e retenção', () => {
  it('link pessoal retira a autorização de promoções; idempotente; token inválido não revela nada', async () => {
    await reg();
    const { rows: [r] } = await env.pool.query('SELECT optout_token, marketing_consent FROM registrations');
    expect(r.optout_token).toMatch(/^[0-9a-f]{32}$/);
    const anon = client(env.base, { register: false });
    expect((await anon.post('/api/promocoes/sair', { token: 'f'.repeat(32) })).body.error.code).toBe('OPTOUT_INVALID');
    expect((await anon.post('/api/promocoes/sair', { token: 'x' })).status).toBe(404);
    expect((await anon.post('/api/promocoes/sair', { token: r.optout_token })).body).toEqual({ optedOut: true });
    expect((await anon.post('/api/promocoes/sair', { token: r.optout_token })).body).toEqual({ optedOut: true });
    const { rows: [after] } = await env.pool.query('SELECT marketing_consent, marketing_consent_at FROM registrations');
    expect(after).toEqual({ marketing_consent: false, marketing_consent_at: null });
    const { rows: audit } = await env.pool.query("SELECT details::text d FROM audit_events WHERE event='registration.optout'");
    expect(audit.length).toBe(1);
    expect(audit[0].d).not.toMatch(/lia|teste|optout_token/i);
  });

  it('origem válida é guardada (a primeira vence); inválida é ignorada; painel e CSV mostram origem e link', async () => {
    expect((await reg({ source: 'Instagram' })).status).toBe(201);
    await reg({ source: 'mesa' });                                   // recadastro não troca a origem
    await reg({ email: 'zeca@teste.local', source: '<script>', marketingConsent: false });
    const rows = (await env.pool.query('SELECT email, source FROM registrations ORDER BY id')).rows;
    expect(rows).toEqual([{ email: 'lia@teste.local', source: 'instagram' }, { email: 'zeca@teste.local', source: null }]);
    const mgr = client(env.base); await mgr.login('gerente');
    const s = (await mgr.get('/api/staff/registrations')).body;
    expect(s.sources).toEqual(expect.arrayContaining([{ source: 'instagram', n: 1, marketing: 1 }, { source: '', n: 1, marketing: 0 }]));
    expect(s.daily.length).toBe(30);
    expect(s.daily.at(-1).n).toBe(2);
    const lia = s.recent.find((x) => x.email === 'lia@teste.local');
    expect(lia.optoutUrl).toMatch(/\/sair\/#t=[0-9a-f]{32}$/);
    expect(s.recent.find((x) => x.email === 'zeca@teste.local').optoutUrl).toBeNull();
    const res = await fetch(`${env.base}/api/staff/registrations.csv`, { headers: { cookie: [...mgr.jar].map(([k, v]) => `${k}=${v}`).join('; ') } });
    const csv = await res.text();
    expect(csv.split('\r\n')[0]).toContain('origem,link_para_parar_de_receber');
    expect(csv).toMatch(/"instagram","https?:\/\/[^"]+\/sair\/#t=[0-9a-f]{32}"/);
  });

  it('apaga só cadastros sem atividade além do prazo; jogar conta como atividade', async () => {
    await reg();
    await reg({ email: 'antigo@teste.local' });
    await env.pool.query("UPDATE registrations SET last_activity_at = now() - interval '25 months' WHERE email='antigo@teste.local'");
    expect(await purgeInactive(env.pool, 24)).toBe(1);
    expect((await env.pool.query('SELECT email FROM registrations')).rows).toEqual([{ email: 'lia@teste.local' }]);
    expect(await purgeInactive(env.pool, 24)).toBe(0);
    const { rows: [a] } = await env.pool.query("SELECT details FROM audit_events WHERE event='registration.purged'");
    expect(a.details).toEqual({ count: 1, months: 24 });
  });
});
