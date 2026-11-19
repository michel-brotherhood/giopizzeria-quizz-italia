// Configuração lida do ambiente. Nada aqui vai para o bundle do navegador.
const env = process.env;

const APP_ENV = env.APP_ENV || (env.NODE_ENV === 'production' ? 'production' : 'development');
const isProd = APP_ENV === 'production';

function bool(v, dflt = false) {
  if (v === undefined || v === '') return dflt;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

const SESSION_SECRET = env.SESSION_SECRET || (isProd ? '' : 'dev-only-insecure-secret-change-me-0123456789');
if (isProd && SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET ausente ou curto (mínimo 32 caracteres) em produção.');
}

export const config = {
  APP_ENV,
  isProd,
  PORT: Number(env.PORT || 3000),
  DATABASE_URL: env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:54329/gio_dev',
  SESSION_SECRET,
  PUBLIC_BASE_URL: (env.PUBLIC_BASE_URL || 'http://localhost:5173').replace(/\/$/, ''),
  // Campanhas reais (não-teste) só podem ser ativadas com esta flag explícita.
  REAL_CAMPAIGNS_ENABLED: bool(env.REAL_CAMPAIGNS_ENABLED, false),
  TRUST_PROXY: env.TRUST_PROXY ?? (isProd ? '1' : 'loopback'),
  EXPIRY_INTERVAL_SECONDS: Number(env.EXPIRY_INTERVAL_SECONDS || 30),
  STAFF_SESSION_HOURS: Number(env.STAFF_SESSION_HOURS || 12),
  COOKIE_SECURE: bool(env.COOKIE_SECURE, isProd),
  SERVE_STATIC: bool(env.SERVE_STATIC, isProd),
  RATE_LIMIT_ENABLED: bool(env.RATE_LIMIT_ENABLED, true),
  // Cadastros sem nenhuma atividade por este número de meses são apagados (Política de Privacidade, seção 5).
  RETENTION_MONTHS: Math.max(1, Number(env.RETENTION_MONTHS || 24)),
};
