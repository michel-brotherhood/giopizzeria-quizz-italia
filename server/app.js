import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { AppError } from './errors.js';
import { apiRouter } from './routes/api.js';
import { sameOriginMutations, noStore } from './middleware/security.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp(pool, { log = console.log, serveStatic = config.SERVE_STATIC } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', /^\d+$/.test(String(config.TRUST_PROXY)) ? Number(config.TRUST_PROXY) : config.TRUST_PROXY);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: config.isProd ? undefined : false,
  }));
  app.use((_req, res, next) => { res.set('Permissions-Policy', 'camera=(self), geolocation=(), microphone=()'); next(); });

  // Log mínimo: método, caminho sem query, status, duração. Nunca corpo, cookies ou fragmento.
  app.use((req, res, next) => {
    const t = process.hrtime.bigint();
    res.on('finish', () => {
      if (req.path.startsWith('/api/')) log(`${req.method} ${req.path} ${res.statusCode} ${Number(process.hrtime.bigint() - t) / 1e6 | 0}ms`);
    });
    next();
  });

  app.use('/api', noStore, express.json({ limit: '16kb' }), cookieParser(), sameOriginMutations, apiRouter(pool));

  if (serveStatic) {
    const dist = path.join(root, 'dist');
    app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', index: false }));
    app.use(express.static(dist, { index: false, maxAge: 0, setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));
    const page = (file) => (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, file));
    };
    if (fs.existsSync(path.join(dist, 'index.html'))) {
      app.get(['/equipe', '/equipe/'], page('equipe/index.html'));
      app.get(['/privacidade', '/privacidade/'], page('privacidade/index.html'));
      app.get(['/sair', '/sair/'], page('sair/index.html'));
      app.get('/', page('index.html'));
    }
  }

  // eslint-disable-next-line no-unused-vars
  app.use((e, req, res, _next) => {
    if (e instanceof AppError) {
      return res.status(e.status).json({ error: { code: e.code, message: e.message, ...(e.extra ? { details: e.extra } : {}) } });
    }
    if (e.type === 'entity.parse.failed' || e.type === 'entity.too.large') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Requisição inválida.' } });
    }
    log(`[erro] ${req.method} ${req.path}: ${e.code ?? ''} ${e.message}`);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Erro interno. Tente novamente em instantes.' } });
  });
  return app;
}
