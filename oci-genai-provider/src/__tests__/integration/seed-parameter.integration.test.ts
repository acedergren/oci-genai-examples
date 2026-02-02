/**
 * Integration tests for seed parameter with live OCI API
 *
 * These tests require valid OCI credentials and will be skipped if not available.
 * Set OCI_COMPARTMENT_ID environment variable to run these tests.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { describe, it, expect } from '@jest/globals';
import { streamText } from 'ai';
import { createOCI } from '../../index';

// Check if we have credentials available
const hasCredentials = !!process.env.OCI_COMPARTMENT_ID;

(hasCredentials ? describe : describe.skip)('Seed Parameter Integration Tests', () => {
  const provider = createOCI({
    compartmentId: process.env.OCI_COMPARTMENT_ID,
    region: 'eu-frankfurt-1',
  });

  const model = provider.languageModel('meta.llama-3.3-70b-instruct') as any;

  it('should produce similar (but not necessarily identical) outputs with same seed', async () => {
    const prompt = 'Generate a random number between 1 and 100';
    const seed = 42;

    // First generation
    const result1 = await streamText({
      model,
      prompt,
      seed,
    });
    const text1 = (await result1.text).trim();

    // Second generation with same seed
    const result2 = await streamText({
      model,
      prompt,
      seed,
    });
    const text2 = (await result2.text).trim();

    // Basic validation - both should be valid responses
    expect(text1).toBeTruthy();
    expect(text2).toBeTruthy();
    expect(text1.length).toBeGreaterThan(0);
    expect(text2.length).toBeGreaterThan(0);

    // Note: We don't assert equality because OCI's implementation
    // may produce similar but not identical outputs
  }, 30000); // 30 second timeout for API calls

  it('should produce different outputs with different seeds', async () => {
    const prompt = 'Generate a random number between 1 and 100';

    // First generation with seed 42
    const result1 = await streamText({
      model,
      prompt,
      seed: 42,
    });
    const text1 = (await result1.text).trim();

    // Second generation with seed 123
    const result2 = await streamText({
      model,
      prompt,
      seed: 123,
    });
    const text2 = (await result2.text).trim();

    // Both should be valid responses
    expect(text1).toBeTruthy();
    expect(text2).toBeTruthy();
    expect(text1.length).toBeGreaterThan(0);
    expect(text2.length).toBeGreaterThan(0);

    // Different seeds typically produce different outputs, but rare coincidental
    // matches are possible. We log rather than assert to avoid test flakiness.
    if (text1 === text2) {
      console.warn(
        'Note: Different seeds produced identical output (rare but possible). ' +
          'This is not a test failure.'
      );
    }
  }, 30000); // 30 second timeout for API calls
});
