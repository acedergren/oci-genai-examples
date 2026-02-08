import { describe, it, expect, vi, afterEach } from 'vitest';

describe('loadConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns defaults when no env vars are set', async () => {
    const { loadConfig } = await import('./config.js');
    const config = loadConfig();

    expect(config.port).toBe(3001);
    expect(config.host).toBe('0.0.0.0');
    expect(config.corsOrigin).toBe('http://localhost:5173');
    expect(config.rateLimitMax).toBe(100);
    expect(config.logLevel).toBe('info');
    expect(config.nodeEnv).toBe('test');
  });

  it('reads values from environment variables', async () => {
    vi.stubEnv('PORT', '4000');
    vi.stubEnv('HOST', '127.0.0.1');
    vi.stubEnv('CORS_ORIGIN', 'https://portal.example.com');
    vi.stubEnv('RATE_LIMIT_MAX', '50');
    vi.stubEnv('LOG_LEVEL', 'debug');
    vi.stubEnv('NODE_ENV', 'production');

    // Re-import to pick up new env
    const { loadConfig } = await import('./config.js');
    const config = loadConfig();

    expect(config.port).toBe(4000);
    expect(config.host).toBe('127.0.0.1');
    expect(config.corsOrigin).toBe('https://portal.example.com');
    expect(config.rateLimitMax).toBe(50);
    expect(config.logLevel).toBe('debug');
    expect(config.nodeEnv).toBe('production');
  });

  it('rejects invalid PORT values', async () => {
    vi.stubEnv('PORT', 'not-a-number');

    const { loadConfig } = await import('./config.js');
    expect(() => loadConfig()).toThrow();
  });

  it('rejects invalid LOG_LEVEL values', async () => {
    vi.stubEnv('LOG_LEVEL', 'verbose');

    const { loadConfig } = await import('./config.js');
    expect(() => loadConfig()).toThrow();
  });

  it('coerces PORT string to number', async () => {
    vi.stubEnv('PORT', '8080');

    const { loadConfig } = await import('./config.js');
    const config = loadConfig();

    expect(config.port).toBe(8080);
    expect(typeof config.port).toBe('number');
  });
});
