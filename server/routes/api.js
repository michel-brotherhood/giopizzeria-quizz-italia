import express from 'express';
import { config } from '../config.js';
import { err } from '../errors.js';
import { PLAYER_COOKIE, STAFF_COOKIE, cookieOpts, requirePlayer, requireStaff, limits } from '../middleware/security.js';
import { campaignView, getActiveCampaign, getCurrentForStaff, createCampaign, updateCampaign, setCampaignState, missingForActivation } from '../services/campaigns.js';
import { exchangeInvitation, getSessionState, answerQuestion, completeSession } from '../services/player.js';
import { login, logout, operatorView, createInvitation, lookupVoucher, redeemVoucher, recentInvitations } from '../services/staff.js';
import QRCode from 'qrcode';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const PLAYER_COOKIE_MS = 24 * 3600_000;

export function apiRouter(pool) {
  const r = express.Router();
  const player = requirePlayer(pool);
  const staff = requireStaff(pool);
  const manager = requireStaff(pool, ['manager']);

  r.get('/health', wrap(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true, env: config.APP_ENV });
  }));

  // ---------- público ----------
  r.get('/campaign/current', wrap(async (_req, res) => {
    const c = await getActiveCampaign(pool);
    res.json({ mode: c ? 'campaign' : 'demo', campaign: c ? campaignView(c) : null });
  }));

  // ---------- jogador ----------
  r.post('/player/exchange', limits.exchange(), wrap(async (req, res) => {
    const out = await exchangeInvitation(pool, req.body?.token);
    res.cookie(PLAYER_COOKIE, out.credential, cookieOpts(PLAYER_COOKIE_MS));
    res.json({ resumed: out.resumed, ...(await getSessionState(pool, out.sessionId)) });
  }));

  r.get('/player/session', limits.player(), player, wrap(async (req, res) => {
    res.json(await getSessionState(pool, req.playerSessionId));
  }));

  r.post('/player/session/answer', limits.player(), player, wrap(async (req, res) => {
    res.json(await answerQuestion(pool, req.playerSessionId, req.body ?? {}, req.get('idempotency-key')));
  }));

  r.post('/player/session/complete', limits.player(), player, wrap(async (req, res) => {
    res.json(await completeSession(pool, req.playerSessionId, req.get('idempotency-key')));
  }));

  r.get('/player/voucher', limits.player(), player, wrap(async (req, res) => {
    const s = await getSessionState(pool, req.playerSessionId);
    res.json({ serverTime: s.serverTime, voucher: s.voucher });
  }));

  r.post('/player/leave', wrap(async (_req, res) => {
    res.clearCookie(PLAYER_COOKIE, { ...cookieOpts(0), maxAge: undefined });
    res.json({ ok: true });
  }));

  // ---------- equipe ----------
  r.post('/staff/login', limits.login(), wrap(async (req, res) => {
    const out = await login(pool, req.body?.username, req.body?.password);
    res.cookie(STAFF_COOKIE, out.token, cookieOpts(out.expiresAt.getTime() - Date.now()));
    res.json({ operator: out.operator, csrfToken: out.csrf });
  }));

  r.post('/staff/logout', staff, wrap(async (req, res) => {
    await logout(pool, req.staff);
    res.clearCookie(STAFF_COOKIE, { ...cookieOpts(0), maxAge: undefined });
    res.json({ ok: true });
  }));

  r.get('/staff/me', staff, wrap(async (req, res) => {
    res.json({ operator: operatorView(req.staff), csrfToken: req.staff.csrf_token, env: config.APP_ENV, realCampaignsEnabled: config.REAL_CAMPAIGNS_ENABLED });
  }));

  r.get('/staff/overview', staff, limits.staff(), wrap(async (_req, res) => {
    const c = await getCurrentForStaff(pool);
    res.json({
      serverTime: new Date().toISOString(),
      campaign: campaignView(c, { full: true }),
      invitations: c ? await recentInvitations(pool, c.id) : [],
    });
  }));

  r.post('/staff/invitations', staff, limits.staff(), wrap(async (req, res) => {
    const out = await createInvitation(pool, req.staff, req.body?.accountRef);
    const qrSvg = await QRCode.toString(out.url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#041E42', light: '#FFFFFF' } });
    res.json({ ...out, qrSvg });
  }));

  r.post('/staff/vouchers/lookup', staff, limits.lookup(), wrap(async (req, res) => {
    res.json({ voucher: await lookupVoucher(pool, req.staff, req.body?.code) });
  }));

  r.post('/staff/vouchers/redeem', staff, limits.lookup(), wrap(async (req, res) => {
    res.json({ voucher: await redeemVoucher(pool, req.staff, req.body?.code, req.get('idempotency-key')) });
  }));

  // ---------- gerente: campanha ----------
  r.get('/staff/campaigns', manager, wrap(async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM campaigns ORDER BY id DESC LIMIT 50');
    res.json({ campaigns: rows.map((c) => ({ ...campaignView(c, { full: true }), missing: missingForActivation(c) })) });
  }));
  r.post('/staff/campaigns', manager, wrap(async (req, res) => {
    res.status(201).json({ campaign: campaignView(await createCampaign(pool, req.staff, req.body ?? {}), { full: true }) });
  }));
  r.patch('/staff/campaigns/:id', manager, wrap(async (req, res) => {
    res.json({ campaign: campaignView(await updateCampaign(pool, req.staff, Number(req.params.id), req.body ?? {}), { full: true }) });
  }));
  for (const [action, target] of [['activate', 'active'], ['pause', 'paused'], ['close', 'closed']]) {
    r.post(`/staff/campaigns/:id/${action}`, manager, wrap(async (req, res) => {
      res.json({ campaign: campaignView(await setCampaignState(pool, req.staff, Number(req.params.id), target), { full: true }) });
    }));
  }

  r.use((_req, _res, next) => next(err('NOT_FOUND')));
  return r;
}
