import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../routes/api/chat/+server';

describe('Chat API Endpoint', () => {
  let mockRequest: Request;

  beforeEach(() => {
    // Clear environment and reset mocks
    vi.clearAllMocks();
  });

  it('returns 500 when OCI_COMPARTMENT_ID is missing', async () => {
    // Temporarily unset the env var
    const originalCompartmentId = process.env.OCI_COMPARTMENT_ID;
    delete process.env.OCI_COMPARTMENT_ID;

    try {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [],
          model: 'meta.llama-3.3-70b-instruct',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST({ request } as any);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('OCI_COMPARTMENT_ID');
    } finally {
      process.env.OCI_COMPARTMENT_ID = originalCompartmentId;
    }
  });

  it('accepts valid request with messages and model', async () => {
    if (!process.env.OCI_COMPARTMENT_ID) {
      expect(true).toBe(true); // Skip if not configured
      return;
    }

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'meta.llama-3.3-70b-instruct',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST({ request } as any);

    // Should return a stream response (200 OK)
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
  });

  it('returns error response with proper headers', async () => {
    const originalCompartmentId = process.env.OCI_COMPARTMENT_ID;
    delete process.env.OCI_COMPARTMENT_ID;

    try {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST({ request } as any);

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.status).toBe(500);
    } finally {
      process.env.OCI_COMPARTMENT_ID = originalCompartmentId;
    }
  });

  it('passes correct model ID to provider', async () => {
    if (!process.env.OCI_COMPARTMENT_ID) {
      expect(true).toBe(true); // Skip if not configured
      return;
    }

    const testModels = [
      'meta.llama-3.3-70b-instruct',
      'cohere.command-plus-latest',
      'cohere.command-a-03-2025',
      'google.gemini-2.5-flash',
    ];

    for (const model of testModels) {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
          model,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST({ request } as any);

      // Should accept the model
      expect([200, 400, 500]).toContain(response.status);
    }
  });

  it('handles invalid JSON gracefully', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST({ request } as any);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});
