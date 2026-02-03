// kyc-platform/src/embeddings/generator.ts

import type { Customer } from '../types.js';

/**
 * Configuration for embedding generation
 */
export interface EmbeddingConfig {
  model: string;
  region: string;
  compartmentId?: string;
}

/**
 * Generate a text representation of a customer for embedding
 * This combines all relevant customer attributes into a meaningful text
 */
export function customerToEmbeddingText(customer: Customer): string {
  const parts: string[] = [];

  // Identity
  parts.push(`Customer: ${customer.first_name} ${customer.last_name}`);
  parts.push(`Email: ${customer.email}`);

  if (customer.occupation) {
    parts.push(`Occupation: ${customer.occupation}`);
  }

  if (customer.employer) {
    parts.push(`Employer: ${customer.employer}`);
  }

  // Financial profile
  if (customer.annual_income) {
    const incomeRange = categorizeIncome(customer.annual_income);
    parts.push(`Income: ${incomeRange}`);
  }

  if (customer.net_worth) {
    const wealthRange = categorizeWealth(customer.net_worth);
    parts.push(`Net Worth: ${wealthRange}`);
  }

  // Location
  if (customer.city && customer.country) {
    parts.push(`Location: ${customer.city}, ${customer.country}`);
  } else if (customer.country) {
    parts.push(`Country: ${customer.country}`);
  }

  // Risk & Status
  if (customer.risk_level) {
    parts.push(`Risk Level: ${customer.risk_level}`);
  }

  parts.push(`KYC Status: ${customer.kyc_status}`);

  // Additional context from tags
  if (customer.tags) {
    try {
      const tags = JSON.parse(customer.tags);
      if (Array.isArray(tags) && tags.length > 0) {
        parts.push(`Tags: ${tags.join(', ')}`);
      }
    } catch {
      // Ignore invalid JSON
    }
  }

  return parts.join('. ');
}

/**
 * Categorize income into ranges for better embedding similarity
 */
function categorizeIncome(income: number): string {
  if (income < 30000) return 'Low income (< $30k)';
  if (income < 60000) return 'Middle income ($30k-$60k)';
  if (income < 100000) return 'Upper middle income ($60k-$100k)';
  if (income < 200000) return 'High income ($100k-$200k)';
  return 'Very high income (> $200k)';
}

/**
 * Categorize wealth into ranges
 */
function categorizeWealth(netWorth: number): string {
  if (netWorth < 50000) return 'Low net worth (< $50k)';
  if (netWorth < 250000) return 'Middle net worth ($50k-$250k)';
  if (netWorth < 1000000) return 'Upper middle net worth ($250k-$1M)';
  if (netWorth < 5000000) return 'High net worth ($1M-$5M)';
  return 'Very high net worth (> $5M)';
}

/**
 * Embedding result interface
 */
export interface EmbeddingResult {
  embedding: Float32Array;
  dimensions: number;
  text: string;
}

/**
 * Convert Float32Array to Buffer for database storage
 */
export function embeddingToBuffer(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
}

/**
 * Convert Buffer back to Float32Array for similarity calculations
 */
export function bufferToEmbedding(buffer: Buffer): Float32Array {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate Euclidean distance between two embeddings
 */
export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Batch process customers for embedding generation
 * Returns customer IDs and their embedding texts
 */
export function batchCustomersForEmbedding(
  customers: Customer[],
  batchSize: number = 96
): Array<{ id: string; text: string }[]> {
  const items = customers.map((customer) => ({
    id: customer.id,
    text: customerToEmbeddingText(customer),
  }));

  const batches: Array<{ id: string; text: string }[]> = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  return batches;
}
