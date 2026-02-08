import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/health'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('api');
    expect(body.timestamp).toBeDefined();
  });
});
