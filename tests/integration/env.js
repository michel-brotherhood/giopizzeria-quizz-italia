process.env.APP_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:54330/gio_itest';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.PUBLIC_BASE_URL = 'http://test.local';
process.env.SESSION_SECRET = 'integration-test-secret-0123456789abcdef';
