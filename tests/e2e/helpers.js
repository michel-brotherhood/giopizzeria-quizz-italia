import pg from 'pg';
import { expect } from '@playwright/test';

export const DB = 'postgres://postgres:postgres@127.0.0.1:54331/gio_e2e';
export const STAFF = { username: 'atendente.teste', password: 'e2e-atendente-senha' };
export const MANAGER = { username: 'gerente.teste', password: 'e2e-gerente-senha' };

export async function db(sql, params) {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try { return (await c.query(sql, params)).rows; } finally { await c.end(); }
}

/** Login da equipe via API (contexto de requisição isolado) e criação de convite. */
export async function createInvite(request, accountRef) {
  const login = await request.post('/api/staff/login', { data: STAFF });
  expect(login.ok()).toBeTruthy();
  const { csrfToken } = await login.json();
  const r = await request.post('/api/staff/invitations', { data: { accountRef }, headers: { 'x-csrf-token': csrfToken } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

/** Responde a pergunta atual; `pick` = 'first' ou 'correct' (consulta o banco no modo servidor). */
export async function answerCurrent(page, { correctFrom } = {}) {
  let target = page.locator('.opt').first();
  if (correctFrom) {
    const qText = await page.locator('#q-text').textContent();
    const q = correctFrom.find((x) => x.question === qText);
    target = page.locator(`.opt[data-option="${q.correctOptionId}"]`);
  }
  await target.click();
  await expect(page.locator('#feedback')).toBeVisible();
}

export async function settle(page) {
  await page.evaluate(() => window.__gioDebug?.settle?.());
  await page.waitForTimeout(400);
}

export async function noHorizontalScroll(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, `scroll horizontal: ${sw} > ${cw}`).toBeLessThanOrEqual(cw);
}
