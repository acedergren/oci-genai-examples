/**
 * Generic OCI Client Factory
 *
 * Provides centralized client creation and caching for all OCI service clients.
 * Caches clients by endpoint to avoid redundant authentication and initialization.
 *
 * @example
 * ```typescript
 * const factory = new OCIClientFactory(GenerativeAiInferenceClient, config);
 * const client = await factory.getClient(); // Creates and caches
 * const same = await factory.getClient(); // Returns cached instance
 * ```
 */

import { Region } from 'oci-common';
import { createAuthProvider, getRegion } from '../auth';
import { resolveEndpoint } from './provider-options';
import type { OCIConfig } from '../types';

/**
 * Constructor signature for OCI service clients.
 * All OCI clients accept authenticationDetailsProvider in their config.
 */
interface OCIClientConstructor<T> {
  new (config: { authenticationDetailsProvider: unknown }): T;
}

/**
 * Generic factory for creating and caching OCI service clients.
 *
 * @template T - The OCI client type (e.g., GenerativeAiInferenceClient)
 */
export class OCIClientFactory<T extends { region?: unknown; endpoint?: string }> {
  private cache = new Map<string, T>();

  /**
   * Create a new client factory.
   *
   * @param ClientClass - The OCI client constructor
   * @param config - Base OCI configuration
   */
  constructor(
    private ClientClass: OCIClientConstructor<T>,
    private config: OCIConfig
  ) {}

  /**
   * Get or create a client instance.
   *
   * Clients are cached by endpoint to avoid redundant initialization.
   * The cache key is: endpointOverride ?? config.endpoint ?? 'default'
   *
   * @param endpointOverride - Optional endpoint override for this request
   * @returns Promise resolving to the cached or newly created client
   */
  async getClient(endpointOverride?: string): Promise<T> {
    const resolvedEndpoint = resolveEndpoint(this.config.endpoint, endpointOverride);
    const cacheKey = resolvedEndpoint ?? this.config.endpoint ?? 'default';

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Create new client
    const authProvider = await createAuthProvider(this.config);
    const regionId = getRegion(this.config);

    const client = new this.ClientClass({
      authenticationDetailsProvider: authProvider,
    });

    // Set region using OCI Region API
    client.region = Region.fromRegionId(regionId);

    // Set custom endpoint if provided
    if (resolvedEndpoint) {
      client.endpoint = resolvedEndpoint;
    }

    // Cache the client
    this.cache.set(cacheKey, client);

    return client;
  }

  /**
   * Clear the client cache.
   * Useful for testing or when credentials change.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached clients.
   * Useful for monitoring and debugging.
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}
