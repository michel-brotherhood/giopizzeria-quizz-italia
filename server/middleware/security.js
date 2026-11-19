import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { err } from '../errors.js';
import { safeEqual } from '../services/crypto.js';
import { staffFromToken } from '../services/staff.js';
import { sessionIdFromCredential } from '../services/player.js';

export const PLAYER_COOKIE = 'gio_player';
export const STAFF_COOKIE = 'gio_staff';

export function cookieOpts(maxAgeMs) {
  return { httpOnly: true, secure: config.COOKIE_SECURE, sameSite: 'strict', path: '/', maxAge: maxAgeMs };
}

/** Bloqueia mutações cross-site: exige JSON e Origin/Sec-Fetch-Site compatíveis com a própria origem. */
export function sameOriginMutations(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.is('application/json')) return next(err('BAD_REQUEST', null, 'Conteúdo deve ser JSON.'));
  const site = req.get('sec-fetch-site');
  if (site && !['same-origin', 'none'].includes(site)) return next(err('CSRF_FAILED'));
  const origin = req.get('origin');
  if (origin) {
    const allowed = new Set([config.PUBLIC_BASE_URL, `${req.protocol}://${req.get('host')}`]);
    if (!allowed.has(origin)) return next(err('CSRF_FAILED'));
  }
  next();
}

export function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

export function requirePlayer(pool) {
  return async (req, _res, next) => {
    try {
      const id = await sessionIdFromCredential(pool, req.cookies?.[PLAYER_COOKIE]);
      if (!id) throw err('SESSION_REQUIRED');
      req.playerSessionId = id;
      next();
    } catch (e) { next(e); }
  };
}

export function requireStaff(pool, roles) {
  return async (req, _res, next) => {
    try {
      const staff = await staffFromToken(pool, req.cookies?.[STAFF_COOKIE]);
      if (!staff) throw err('UNAUTHENTICATED');
      if (roles && !roles.includes(staff.role)) throw err('FORBIDDEN');
      if (!['GET', 'HEAD'].includes(req.method) && !safeEqual(req.get('x-csrf-token') ?? '', staff.csrf_token)) {
        throw err('CSRF_FAILED');
      }
      req.staff = staff;
      next();
    } catch (e) { next(e); }
  };
}

function limiter(opts) {
  if (!config.RATE_LIMIT_ENABLED) return (_req, _res, next) => next();
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(err('RATE_LIMITED')),
    ...opts,
  });
}

export const limits = {
  login: () => limiter({ windowMs: 15 * 60_000, limit: 10, skipSuccessfulRequests: true }),
  exchange: () => limiter({ windowMs: 60_000, limit: 20 }),
  player: () => limiter({ windowMs: 60_000, limit: 120 }),
  lookup: () => limiter({ windowMs: 60_000, limit: 40, keyGenerator: (req) => `op:${req.staff?.id ?? req.ip}` }),
  staff: () => limiter({ windowMs: 60_000, limit: 120, keyGenerator: (req) => `op:${req.staff?.id ?? req.ip}` }),
};
