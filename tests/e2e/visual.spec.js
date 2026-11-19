// Capturas para revisão visual (docs/screenshots) + verificações de layout por viewport.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import bank from '../../content/questions.seed.json' with { type: 'json' };
import { drawRound, seededRng } from '../../shared/quiz.js';
import { createInvite, answerCurrent, settle, noHorizontalScroll, STAFF } from './helpers.js';

const OUT = 'docs/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [[360, 800], [390, 844], [768, 1024], [1440, 900], [844, 390]];

// Partida de demonstração com a pergunta mais longa do banco na posição atual.
function longQuestionState() {
  const longest = bank.questions.reduce((a, b) => (b.question.length + b.options.reduce((s, o) => s + o.text.length, 0) > a.question.length + a.options.reduce((s, o) => s + o.text.length, 0) ? b : a));
  const round = drawRound(bank.questions.filter((q) => q.id !== longest.id), seededRng(5));
  round[1] = { ...longest, options: longest.options.map((o) => ({ ...o })) };
  const first = round[0];
  return { round, answers: [{ position: 0, questionId: first.id, selectedOptionId: first.correctOptionId, correct: true, correctOptionId: first.correctOptionId, explanation: first.explanation }] };
}

for (const [w, h] of VIEWPORTS) {
  test.describe(`${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test('abertura, pergunta longa, feedback e resultado (demo)', async ({ page }) => {
      test.setTimeout(240_000); // 8 perguntas + capturas com WebGL por software
      await page.goto('/');
      await page.waitForTimeout(2500);
      await noHorizontalScroll(page);
      const cta = await page.locator('#btn-start').boundingBox();
      if (h >= 700) expect(cta.y + cta.height, 'CTA visível sem rolagem').toBeLessThanOrEqual(h);
      await page.screenshot({ path: `${OUT}/${w}x${h}-01-abertura.png` });

      const state = longQuestionState();
      await page.evaluate((s) => sessionStorage.setItem('gio.demo.v1', JSON.stringify(s)), state);
      await page.reload();
      await expect(page.locator('#q-count')).toHaveText('Pergunta 2 de 8');
      await settle(page);
      await noHorizontalScroll(page);
      await page.screenshot({ path: `${OUT}/${w}x${h}-02-pergunta-longa.png`, fullPage: true });
      // alternativas não truncadas: cada botão mostra o texto inteiro
      for (const o of await page.locator('.opt .txt').all()) {
        const clipped = await o.evaluate((n) => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1);
        expect(clipped).toBe(false);
      }
      await page.locator('.opt').nth(2).click();
      await expect(page.locator('#feedback')).toBeVisible();
      await page.waitForTimeout(1200);
      await settle(page);
      await page.screenshot({ path: `${OUT}/${w}x${h}-03-feedback.png`, fullPage: true });
      for (let i = 2; i < 8; i++) { await page.locator('#btn-next').click(); await answerCurrent(page); }
      await page.locator('#btn-next').click();
      await expect(page.locator('[data-view="result"]')).toBeVisible();
      await page.waitForTimeout(1200);
      await settle(page);
      await noHorizontalScroll(page);
      await page.screenshot({ path: `${OUT}/${w}x${h}-04-resultado-demo.png`, fullPage: true });
    });
  });
}

for (const [w, h] of [[390, 844], [1440, 900], [844, 390]]) {
  test(`voucher de teste e painel da equipe ${w}x${h}`, async ({ browser, request }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const inv = await createInvite(request, `VIS-${w}`);
    await page.goto(inv.url.replace('http://localhost:3100', ''));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${w}x${h}-05-convite.png`, fullPage: true });
    await page.getByRole('button', { name: 'Começar com brinde' }).click();
    for (let i = 0; i < 8; i++) { await answerCurrent(page); await page.locator('#btn-next').click(); }
    await expect(page.locator('.voucher')).toBeVisible();
    await page.waitForTimeout(1200);
    await settle(page);
    await noHorizontalScroll(page);
    await page.screenshot({ path: `${OUT}/${w}x${h}-06-voucher.png`, fullPage: true });

    const staff = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
    await staff.goto('/equipe/');
    await staff.getByLabel('Usuário').fill(STAFF.username);
    await staff.getByLabel('Senha').fill(STAFF.password);
    await staff.getByRole('button', { name: 'Entrar' }).click();
    await expect(staff.locator('.counters')).toBeVisible();
    await staff.getByLabel('Referência da conta').fill(`MESA ${w}`);
    await staff.getByRole('button', { name: 'Gerar convite' }).click();
    await expect(staff.locator('#invite-out .qr svg')).toBeVisible();
    await noHorizontalScroll(staff);
    await staff.screenshot({ path: `${OUT}/${w}x${h}-07-equipe-convite.png`, fullPage: true });
    await staff.getByRole('tab', { name: 'Conferir brinde' }).click();
    await staff.getByLabel('Código do brinde').fill(await page.locator('.voucher .code').textContent());
    await staff.getByRole('button', { name: 'Consultar' }).click();
    await expect(staff.locator('#check-out')).toContainText('Disponível');
    await staff.screenshot({ path: `${OUT}/${w}x${h}-08-equipe-consulta.png`, fullPage: true });
    await ctx.close();
  });
}

test('zoom 200% (1440x900 a 200% = 720x450 CSS px) sem scroll horizontal', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForTimeout(2000);
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${OUT}/zoom200-01-abertura.png` });
  await page.locator('#btn-start').click();
  await answerCurrent(page);
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${OUT}/zoom200-02-feedback.png`, fullPage: true });
  await ctx.close();
});

test('movimento reduzido: troca direta de etapa', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForTimeout(2000);
  await page.locator('#btn-start').click();
  await answerCurrent(page);
  // sem fila de animação: estado final aplicado imediatamente
  const st = await page.evaluate(() => window.__gioDebug.sceneState());
  if (st) expect(st.queue === 0 && st.seg === false).toBe(true);
  await page.screenshot({ path: `${OUT}/reduced-motion-feedback.png` });
  await ctx.close();
});

test('modo leve manual mantém identidade e jogo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#light-toggle').click();
  await expect(page.locator('.light-scene')).toBeVisible();
  await page.screenshot({ path: `${OUT}/modo-leve-01-abertura.png` });
  await page.locator('#btn-start').click();
  for (let i = 0; i < 3; i++) { await answerCurrent(page); await page.locator('#btn-next').click(); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/modo-leve-02-etapa3.png` });
});

test('métricas da cena 3D', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => window.__gioDebug.sceneInfo());
  fs.writeFileSync(`${OUT}/scene-metrics-390.json`, JSON.stringify(info, null, 2));
  expect(info.triangles).toBeLessThanOrEqual(60000);
  expect(info.calls).toBeLessThanOrEqual(90);
  expect(info.dpr).toBeLessThanOrEqual(1.5);
});
