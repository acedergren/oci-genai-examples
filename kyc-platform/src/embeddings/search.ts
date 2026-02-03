// kyc-platform/src/embeddings/search.ts

import type { Customer, EmbeddingSearchResult } from '../types.js';
import { bufferToEmbedding, cosineSimilarity, euclideanDistance } from './generator.js';

/**
 * Search options for vector similarity
 */
export interface VectorSearchOptions {
  /**
   * Similarity threshold (0-1). Results below this threshold are filtered out.
   * Default: 0.7
   */
  threshold?: number;

  /**
   * Maximum number of results to return
   * Default: 10
   */
  limit?: number;

  /**
   * Distance metric to use
   * - 'cosine': Cosine similarity (default, range 0-1, higher is better)
   * - 'euclidean': Euclidean distance (lower is better)
   */
  metric?: 'cosine' | 'euclidean';
}

/**
 * Search for similar customers using vector embeddings
 *
 * @param queryEmbedding - The embedding to search for (as Buffer or Float32Array)
 * @param candidates - Array of customers with embeddings
 * @param options - Search options
 * @returns Sorted array of similar customers with similarity scores
 */
export function searchSimilarCustomers(
  queryEmbedding: Buffer | Float32Array,
  candidates: Customer[],
  options: VectorSearchOptions = {}
): EmbeddingSearchResult<Customer>[] {
  const {
    threshold = 0.7,
    limit = 10,
    metric = 'cosine',
  } = options;

  // Convert query embedding to Float32Array if needed
  const queryVector = queryEmbedding instanceof Buffer
    ? bufferToEmbedding(queryEmbedding)
    : queryEmbedding;

  const results: EmbeddingSearchResult<Customer>[] = [];

  for (const customer of candidates) {
    if (!customer.profile_embedding) {
      continue;
    }

    const customerVector = bufferToEmbedding(customer.profile_embedding);

    let similarity: number;
    let distance: number;

    if (metric === 'cosine') {
      similarity = cosineSimilarity(queryVector as Float32Array, customerVector as Float32Array);
      distance = 1 - similarity;

      // Filter by threshold
      if (similarity < threshold) {
        continue;
      }
    } else {
      distance = euclideanDistance(queryVector as Float32Array, customerVector as Float32Array);
      // For Euclidean, we don't have a natural 0-1 range, so threshold is less meaningful
      // We'll still compute similarity as inverse of distance for ranking
      similarity = 1 / (1 + distance);
    }

    results.push({
      item: customer,
      similarity,
      distance,
    });
  }

  // Sort by similarity (descending)
  results.sort((a, b) => b.similarity - a.similarity);

  // Apply limit
  return results.slice(0, limit);
}

/**
 * Find duplicate customers using embedding similarity
 * Returns pairs of customers that are likely duplicates
 */
export interface DuplicatePair {
  customer1: Customer;
  customer2: Customer;
  similarity: number;
}

export function findDuplicateCustomers(
  customers: Customer[],
  threshold: number = 0.95
): DuplicatePair[] {
  const duplicates: DuplicatePair[] = [];

  // Only consider customers with embeddings
  const customersWithEmbeddings = customers.filter((c) => c.profile_embedding);

  for (let i = 0; i < customersWithEmbeddings.length; i++) {
    const customer1 = customersWithEmbeddings[i];
    const embedding1 = bufferToEmbedding(customer1.profile_embedding!);

    for (let j = i + 1; j < customersWithEmbeddings.length; j++) {
      const customer2 = customersWithEmbeddings[j];
      const embedding2 = bufferToEmbedding(customer2.profile_embedding!);

      const similarity = cosineSimilarity(embedding1, embedding2);

      if (similarity >= threshold) {
        duplicates.push({
          customer1,
          customer2,
          similarity,
        });
      }
    }
  }

  // Sort by similarity (descending)
  duplicates.sort((a, b) => b.similarity - a.similarity);

  return duplicates;
}

/**
 * Cluster customers by similarity
 * Simple k-means clustering on embeddings
 */
export interface ClusterResult {
  clusterId: number;
  centroid: Float32Array;
  members: Customer[];
  avgSimilarity: number;
}

/**
 * Simple k-means clustering on customer embeddings
 * Note: This is a basic implementation. For production, consider using a proper ML library.
 */
export function clusterCustomers(
  customers: Customer[],
  k: number = 5,
  maxIterations: number = 100
): ClusterResult[] {
  // Filter customers with embeddings
  const customersWithEmbeddings = customers.filter((c) => c.profile_embedding);

  if (customersWithEmbeddings.length < k) {
    throw new Error(`Not enough customers with embeddings (need at least ${k}, have ${customersWithEmbeddings.length})`);
  }

  const embeddings = customersWithEmbeddings.map((c) => bufferToEmbedding(c.profile_embedding!));
  const dimensions = embeddings[0].length;

  // Initialize centroids with k-means++
  const centroids = initializeCentroidsKMeansPlusPlus(embeddings, k);

  // Cluster assignments
  let assignments = new Array(embeddings.length).fill(0);
  let changed = true;
  let iterations = 0;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Assignment step: assign each point to nearest centroid
    for (let i = 0; i < embeddings.length; i++) {
      let minDistance = Infinity;
      let bestCluster = 0;

      for (let j = 0; j < k; j++) {
        const distance = euclideanDistance(embeddings[i], centroids[j]);
        if (distance < minDistance) {
          minDistance = distance;
          bestCluster = j;
        }
      }

      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    // Update step: recalculate centroids
    for (let j = 0; j < k; j++) {
      const clusterMembers = embeddings.filter((_, i) => assignments[i] === j);
      if (clusterMembers.length > 0) {
        centroids[j] = calculateMean(clusterMembers);
      }
    }
  }

  // Build results
  const results: ClusterResult[] = [];
  for (let j = 0; j < k; j++) {
    const memberIndices = assignments.map((a, i) => (a === j ? i : -1)).filter((i) => i >= 0);
    const members = memberIndices.map((i) => customersWithEmbeddings[i]);

    // Calculate average similarity within cluster
    let totalSimilarity = 0;
    let count = 0;
    for (let i = 0; i < memberIndices.length; i++) {
      for (let j = i + 1; j < memberIndices.length; j++) {
        totalSimilarity += cosineSimilarity(embeddings[memberIndices[i]], embeddings[memberIndices[j]]);
        count++;
      }
    }

    results.push({
      clusterId: j,
      centroid: centroids[j],
      members,
      avgSimilarity: count > 0 ? totalSimilarity / count : 0,
    });
  }

  return results;
}

/**
 * K-means++ initialization for better initial centroids
 */
function initializeCentroidsKMeansPlusPlus(
  embeddings: Float32Array[],
  k: number
): Float32Array[] {
  const centroids: Float32Array[] = [];

  // Choose first centroid randomly
  const firstIndex = Math.floor(Math.random() * embeddings.length);
  centroids.push(new Float32Array(embeddings[firstIndex]));

  // Choose remaining centroids with probability proportional to distance²
  for (let i = 1; i < k; i++) {
    const distances = embeddings.map((embedding) => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = euclideanDistance(embedding, centroid);
        minDist = Math.min(minDist, dist);
      }
      return minDist * minDist; // Distance squared
    });

    // Weighted random selection
    const totalDist = distances.reduce((sum, d) => sum + d, 0);
    let random = Math.random() * totalDist;

    for (let j = 0; j < distances.length; j++) {
      random -= distances[j];
      if (random <= 0) {
        centroids.push(new Float32Array(embeddings[j]));
        break;
      }
    }
  }

  return centroids;
}

/**
 * Calculate mean of embeddings
 */
function calculateMean(embeddings: Float32Array[]): Float32Array {
  if (embeddings.length === 0) {
    throw new Error('Cannot calculate mean of empty array');
  }

  const dimensions = embeddings[0].length;
  const mean = new Float32Array(dimensions);

  for (const embedding of embeddings) {
    for (let i = 0; i < dimensions; i++) {
      mean[i] += embedding[i];
    }
  }

  for (let i = 0; i < dimensions; i++) {
    mean[i] /= embeddings.length;
  }

  return mean;
}
