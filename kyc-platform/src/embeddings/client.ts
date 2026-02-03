// kyc-platform/src/embeddings/client.ts

import type { EmbeddingConfig, EmbeddingResult } from './generator.js';

/**
 * OCI GenAI Embedding Client
 * Wrapper around OCI GenAI embedding models
 */
export class OCIEmbeddingClient {
  private readonly config: EmbeddingConfig;
  private readonly endpoint: string;

  constructor(config: EmbeddingConfig) {
    this.config = config;
    this.endpoint = `https://inference.generativeai.${config.region}.oci.oraclecloud.com`;
  }

  /**
   * Generate embeddings for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const result = await this.embedBatch([text]);
    return result[0];
  }

  /**
   * Generate embeddings for multiple texts in a batch
   * OCI GenAI supports up to 96 texts per batch
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    if (texts.length > 96) {
      throw new Error('Batch size cannot exceed 96 texts');
    }

    // For now, this is a stub that would integrate with @acedergren/oci-genai-provider
    // In a real implementation, this would call the OCI GenAI API
    throw new Error('OCI GenAI embedding integration not yet implemented. Use the embedWithProvider function with @acedergren/oci-genai-provider instead.');
  }
}

/**
 * Create an embedding client
 */
export function createEmbeddingClient(config: EmbeddingConfig): OCIEmbeddingClient {
  return new OCIEmbeddingClient(config);
}

/**
 * Helper function to embed using the oci-genai-provider package
 * This should be used in actual SvelteKit applications
 *
 * Example usage:
 * ```typescript
 * import { embed } from 'ai';
 * import { createOCI } from '@acedergren/oci-genai-provider';
 *
 * const oci = createOCI({ region: 'us-chicago-1' });
 * const model = oci.embeddingModel('cohere.embed-multilingual-v3.0');
 *
 * const { embedding } = await embed({
 *   model,
 *   value: customerToEmbeddingText(customer),
 * });
 *
 * const embeddingBuffer = embeddingToBuffer(new Float32Array(embedding));
 * ```
 */
export const EMBEDDING_MODEL = 'cohere.embed-multilingual-v3.0';
export const EMBEDDING_DIMENSIONS = 1024; // Cohere multilingual v3.0 dimension

/**
 * Interface for embedding with external provider
 */
export interface EmbedWithProviderOptions {
  texts: string[];
  model?: string;
  inputType?: 'search_document' | 'search_query' | 'classification' | 'clustering';
}

/**
 * Documentation for integrating with oci-genai-provider
 */
export const INTEGRATION_GUIDE = `
To generate embeddings in your SvelteKit application:

1. Install dependencies:
   npm install ai @acedergren/oci-genai-provider @acedergren/kyc-platform

2. Set up OCI credentials in .env:
   OCI_REGION=us-chicago-1
   OCI_COMPARTMENT_ID=ocid1.compartment.oc1...

3. Use in your server-side code:
   import { embed } from 'ai';
   import { createOCI } from '@acedergren/oci-genai-provider';
   import { customerToEmbeddingText, embeddingToBuffer } from '@acedergren/kyc-platform/embeddings';

   const oci = createOCI({ region: process.env.OCI_REGION });
   const model = oci.embeddingModel('cohere.embed-multilingual-v3.0');

   async function generateCustomerEmbedding(customer) {
     const text = customerToEmbeddingText(customer);

     const { embedding } = await embed({
       model,
       value: text,
     });

     // Convert to Buffer for database storage
     const buffer = embeddingToBuffer(new Float32Array(embedding));

     // Store in database
     repository.customers.updateEmbedding(customer.id, buffer);

     return buffer;
   }

4. Batch processing for efficiency:
   import { embedMany } from 'ai';
   import { batchCustomersForEmbedding } from '@acedergren/kyc-platform/embeddings';

   async function embedCustomerBatch(customers) {
     const batches = batchCustomersForEmbedding(customers);

     for (const batch of batches) {
       const { embeddings } = await embedMany({
         model,
         values: batch.map(item => item.text),
       });

       // Store embeddings
       for (let i = 0; i < batch.length; i++) {
         const buffer = embeddingToBuffer(new Float32Array(embeddings[i]));
         repository.customers.updateEmbedding(batch[i].id, buffer);
       }
     }
   }
`;
