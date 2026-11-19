import { test, expect } from '@playwright/test';
import { db, createInvite, answerCurrent, settle, STAFF } from './helpers.js';

test.describe('demonstração', () => {
  test('partida completa: 8 perguntas, feedback, pontuação e nenhum brinde', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /demonstração|descobrir/i }).click();
    let correct = 0;
    for (let i = 1; i <= 8; i++) {
      await expect(page.locator('#q-count')).toHaveText(`Pergunta ${i} de 8`);
      await answerCurrent(page);
      await expect(page.locator('.opt[disabled]')).toHaveCount(4);
      if ((await page.locator('#fb-title').textContent()).includes('acertou')) correct++;
      await expect(page.locator('#score-line')).toHaveText(`Pontos: ${correct * 100}`);
      await page.locator('#btn-next').click();
    }
    await expect(page.locator('#r-score')).toHaveText(String(correct));
    await expect(page.locator('.demo-note')).toContainText('nenhum brinde');
    await expect(page.locator('.voucher')).toHaveCount(0);
    expect(await page.evaluate(() => window.__gioDebug.stage())).toBe(9);
  });

  test('storage corrompido não quebra a abertura', async ({ page }) => {
    await page.addInitScript(() => { sessionStorage.setItem('gio.demo.v1', '{quebrado'); localStorage.setItem('gio.demo.seen', 'x{'); });
    await page.goto('/');
    await expect(page.locator('#btn-start')).toBeVisible();
    await page.locator('#btn-start').click();
    await expect(page.locator('#q-count')).toHaveText('Pergunta 1 de 8');
  });

  test('WebGL indisponível: modo leve automático e jogo completo', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...a) { return /webgl/.test(type) ? null : orig.call(this, type, ...a); };
    });
    await page.goto('/');
    await expect(page.locator('.light-scene')).toBeVisible();
    await expect(page.locator('#light-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#btn-start').click();
    await answerCurrent(page);
    await expect(page.locator('.light-scene.s1')).toHaveCount(1);
  });

  test('teclado: começar, responder e avançar sem mouse', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-start').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#q-text')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('.opt').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#fb-title')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-next')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#q-count')).toHaveText('Pergunta 2 de 8');
  });
});

test.describe('campanha de teste autorizada', () => {
  test('convite -> partida -> voucher -> equipe confirma -> cliente vê entrega', async ({ page, request, browser }) => {
    const inv = await createInvite(request, 'E2E-FLUXO-1');
    await page.goto(inv.url.replace('http://localhost:3100', ''));
    // token removido da barra de endereço imediatamente
    await expect.poll(() => page.url()).not.toContain('convite=');
    await expect(page.locator('.offer')).toContainText('DEMONSTRAÇÃO — SEM VALOR DE RESGATE');
    await expect(page.locator('.offer .test-banner')).toBeVisible();
    await page.getByRole('button', { name: 'Começar com brinde' }).click();
    await expect(page.locator('#mode-pill')).toHaveText('Teste');
    const [s] = await db(`SELECT q.question_order FROM quiz_sessions q JOIN invitations i ON i.id=q.invitation_id ORDER BY q.id DESC LIMIT 1`);
    for (let i = 1; i <= 8; i++) {
      await answerCurrent(page, { correctFrom: i % 2 ? s.question_order : undefined });
      await page.locator('#btn-next').click();
    }
    const voucher = page.locator('.voucher');
    await expect(voucher).toBeVisible();
    await expect(voucher.locator('.test-banner')).toHaveText(/sem valor de resgate/i);
    await expect(voucher.locator('.qr svg')).toBeVisible();
    const code = (await voucher.locator('.code').textContent()).trim();
    expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);

    // reload mantém o mesmo voucher
    await page.reload();
    await expect(page.locator('.voucher .code')).toHaveText(code);

    // equipe em outro contexto (outro aparelho)
    const staffCtx = await browser.newContext();
    const staff = await staffCtx.newPage();
    await staff.goto('/equipe/');
    await staff.getByLabel('Usuário').fill(STAFF.username);
    await staff.getByLabel('Senha').fill(STAFF.password);
    await staff.getByRole('button', { name: 'Entrar' }).click();
    await staff.getByRole('tab', { name: 'Conferir brinde' }).click();
    await staff.getByLabel('Código do brinde').fill(code.toLowerCase());
    await staff.getByRole('button', { name: 'Consultar' }).click();
    await expect(staff.locator('#check-out')).toContainText('Disponível para entrega');
    expect((await db(`SELECT state FROM vouchers ORDER BY id DESC LIMIT 1`))[0].state).toBe('issued');
    await staff.getByRole('button', { name: 'Confirmar entrega…' }).click();
    await staff.locator('#cd-yes').click();
    await expect(staff.locator('#check-out')).toContainText('Entrega confirmada');
    // segunda confirmação: já entregue
    await staff.getByRole('button', { name: 'Consultar' }).click();
    await expect(staff.locator('#check-out')).toContainText('Já entregue');

    await page.reload();
    await expect(page.locator('.voucher.redeemed')).toContainText('Entrega confirmada');
    await expect(page.locator('.voucher .code')).toHaveCount(0);
    await staffCtx.close();
  });

  test('rede cai ao enviar resposta: mantém seleção, não avança, reenvia com a mesma chave', async ({ page, request }) => {
    const inv = await createInvite(request, 'E2E-REDE-1');
    await page.goto(inv.url.replace('http://localhost:3100', ''));
    await page.getByRole('button', { name: 'Começar com brinde' }).click();
    const keys = [];
    let fail = true;
    await page.route('**/api/player/session/answer', async (route) => {
      keys.push(route.request().headers()['idempotency-key']);
      if (fail) return route.abort('internetdisconnected');
      return route.continue();
    });
    await page.locator('.opt').nth(1).click();
    await expect(page.locator('#netbox')).toContainText('Sem conexão');
    await expect(page.locator('#feedback')).toBeHidden();
    await expect(page.locator('.opt.pending')).toHaveCount(1);
    fail = false;
    await page.locator('#netbox').getByRole('button', { name: 'Tentar agora' }).click();
    await expect(page.locator('#feedback')).toBeVisible();
    expect(new Set(keys).size).toBe(1);
    const [{ id }] = await db('SELECT id FROM quiz_sessions ORDER BY id DESC LIMIT 1');
    expect((await db('SELECT count(*)::int n FROM answers WHERE session_id=$1', [id]))[0].n).toBe(1);
  });

  test('recarregar no meio da partida retoma a mesma pergunta do servidor', async ({ page, request }) => {
    const inv = await createInvite(request, 'E2E-RELOAD-1');
    await page.goto(inv.url.replace('http://localhost:3100', ''));
    await page.getByRole('button', { name: 'Começar com brinde' }).click();
    for (let i = 0; i < 3; i++) { await answerCurrent(page); await page.locator('#btn-next').click(); }
    const q = await page.locator('#q-text').textContent();
    await page.reload();
    await expect(page.locator('#q-count')).toHaveText('Pergunta 4 de 8');
    await expect(page.locator('#q-text')).toHaveText(q);
    expect(await page.evaluate(() => window.__gioDebug.stage())).toBe(3);
  });

  test('falha de rede na conclusão: "conferindo", sem voucher inventado; depois um único voucher', async ({ page, request }) => {
    const inv = await createInvite(request, 'E2E-COMPLETE-1');
    await page.goto(inv.url.replace('http://localhost:3100', ''));
    await page.getByRole('button', { name: 'Começar com brinde' }).click();
    for (let i = 0; i < 7; i++) { await answerCurrent(page); await page.locator('#btn-next').click(); }
    await answerCurrent(page);
    let fail = true;
    await page.route('**/api/player/session/complete', (route) => (fail ? route.abort('internetdisconnected') : route.continue()));
    await page.locator('#btn-next').click();
    await expect(page.locator('[data-view="completing"]')).toBeVisible();
    await expect(page.locator('#c-netbox')).toContainText('nenhum brinde é considerado válido');
    await expect(page.locator('.voucher')).toHaveCount(0);
    fail = false;
    await page.locator('#c-netbox').getByRole('button', { name: 'Tentar agora' }).click();
    await expect(page.locator('.voucher')).toBeVisible();
    const sid = (await db(`SELECT s.id FROM quiz_sessions s ORDER BY id DESC LIMIT 1`))[0].id;
    expect((await db('SELECT count(*)::int n FROM vouchers WHERE session_id=$1', [sid]))[0].n).toBe(1);
  });

  test('mesmo convite aberto em dois aparelhos: uma única sessão', async ({ browser, request }) => {
    const inv = await createInvite(request, 'E2E-DUAS-1');
    const path = inv.url.replace('http://localhost:3100', '');
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await a.goto(path); await b.goto(path);
    await Promise.all([a.getByRole('button', { name: 'Começar com brinde' }).click(), b.getByRole('button', { name: 'Começar com brinde' }).click()]);
    await expect(a.locator('[data-view="question"]')).toBeVisible();
    await expect(b.locator('[data-view="question"]')).toBeVisible();
    await expect(b.locator('#q-text')).not.toBeEmpty();
    await expect(a.locator('#q-text')).toHaveText(await b.locator('#q-text').textContent());
    const [{ n, reserved }] = await db(`SELECT count(*)::int n, count(*) FILTER (WHERE s.reservation_state='reserved')::int reserved
      FROM quiz_sessions s JOIN invitations i ON i.id=s.invitation_id WHERE i.account_ref_hint='•••S-1'`);
    expect({ n, reserved }).toEqual({ n: 1, reserved: 1 });
    // responder em A e tentar outra alternativa em B: B volta ao estado canônico (resposta de A)
    await a.locator('.opt').first().click();
    await expect(a.locator('#feedback')).toBeVisible();
    await b.locator('.opt').last().click();
    await expect(b.locator('#q-count')).toHaveText('Pergunta 2 de 8');
  });

  test('link do QR na equipe (#v=) só consulta: GET nunca entrega', async ({ browser, request, page }) => {
    const inv = await createInvite(request, 'E2E-QR-1');
    await page.goto(inv.url.replace('http://localhost:3100', ''));
    await page.getByRole('button', { name: 'Começar com brinde' }).click();
    for (let i = 0; i < 8; i++) { await answerCurrent(page); await page.locator('#btn-next').click(); }
    await expect(page.locator('.voucher .qr svg')).toBeVisible();
    const [v] = await db('SELECT id, token_enc FROM vouchers ORDER BY id DESC LIMIT 1');
    process.env.SESSION_SECRET = 'e2e-secret-0123456789abcdef0123456789';
    const { decrypt } = await import('../../server/services/crypto.js');
    const { token } = decrypt(v.token_enc);
    const staffCtx = await browser.newContext();
    const staff = await staffCtx.newPage();
    // GET puro (ex.: prévia de link) não autentica nem consome
    const preview = await staffCtx.request.get(`/equipe/#v=${token}`);
    expect(preview.ok()).toBeTruthy();
    expect((await db('SELECT state FROM vouchers WHERE id=$1', [v.id]))[0].state).toBe('issued');
    // como a câmera do celular faria: abre o painel com o fragmento
    await staff.goto(`/equipe/#v=${token}`);
    await expect.poll(() => staff.url()).not.toContain('#v=');
    await staff.getByLabel('Usuário').fill(STAFF.username);
    await staff.getByLabel('Senha').fill(STAFF.password);
    await staff.getByRole('button', { name: 'Entrar' }).click();
    await expect(staff.locator('#check-out')).toContainText('Disponível para entrega');
    expect((await db('SELECT state FROM vouchers WHERE id=$1', [v.id]))[0].state).toBe('issued');
    await staffCtx.close();
  });

  test('câmera indisponível: painel orienta digitar o código', async ({ page }) => {
    await page.goto('/equipe/');
    await page.getByLabel('Usuário').fill(STAFF.username);
    await page.getByLabel('Senha').fill(STAFF.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.getByRole('tab', { name: 'Conferir brinde' }).click();
    await page.getByRole('button', { name: 'Ler QR com a câmera' }).click();
    await expect(page.locator('#check-out')).toContainText(/Digite o código/);
  });

  test('bundle público não contém segredos nem rotas de PIN', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const scripts = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
    const staffHtml = await (await request.get('/equipe/')).text();
    scripts.push(...[...staffHtml.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]));
    for (const s of scripts) {
      const js = await (await request.get(s)).text();
      expect(js).not.toMatch(/SESSION_SECRET|e2e-secret|e2e-atendente-senha|DATABASE_URL|postgres:\/\//);
      expect(js).not.toMatch(/\bpin\s*[:=]/i);
    }
  });
});
