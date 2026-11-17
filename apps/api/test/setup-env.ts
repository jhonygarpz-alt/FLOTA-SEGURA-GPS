process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://flota:flota@localhost:5432/flota_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789-0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789-0123456789';
process.env.DEMO_ENABLED = 'true';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.AUTH_RATE_LIMIT = '1000';
