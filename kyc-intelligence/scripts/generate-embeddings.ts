// scripts/generate-embeddings.ts
import { embedMany } from 'ai';
import { createOCI } from '@acedergren/oci-genai-provider';
import { getDatabase, createRepository } from '@acedergren/kyc-platform';
import {
  customerToEmbeddingText,
  embeddingToBuffer,
  batchCustomersForEmbedding,
} from '@acedergren/kyc-platform/embeddings';

/**
 * Generate embeddings for all customers without embeddings
 * Uses OCI GenAI's Cohere embedding model (cohere.embed-multilingual-v3.0)
 */
async function generateEmbeddings() {
  console.log('🧬 Generating customer embeddings...\n');

  // Check for OCI credentials
  const region = process.env.OCI_REGION;
  if (!region) {
    console.error('❌ Error: OCI_REGION environment variable not set');
    console.log('\n💡 Set up your OCI credentials:');
    console.log('   export OCI_REGION=us-chicago-1');
    console.log('   export OCI_COMPARTMENT_ID=ocid1.compartment.oc1...');
    process.exit(1);
  }

  const db = getDatabase();
  const repository = createRepository(db.getConnection());

  // Get customers without embeddings
  const allCustomers = repository.customers.list();
  const customersWithoutEmbeddings = allCustomers.filter((c) => !c.profile_embedding);

  if (customersWithoutEmbeddings.length === 0) {
    console.log('✅ All customers already have embeddings!');
    return;
  }

  console.log(`📊 Found ${customersWithoutEmbeddings.length} customers without embeddings`);
  console.log(`📊 ${allCustomers.length - customersWithoutEmbeddings.length} customers already have embeddings\n`);

  // Create OCI client
  const oci = createOCI({ region });
  const model = oci.embeddingModel('cohere.embed-multilingual-v3.0');

  console.log(`🔗 Using model: cohere.embed-multilingual-v3.0`);
  console.log(`🌍 Region: ${region}\n`);

  // Batch customers (max 96 per batch for OCI GenAI)
  const batches = batchCustomersForEmbedding(customersWithoutEmbeddings, 96);
  console.log(`📦 Processing ${batches.length} batches...\n`);

  let processedCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`   Batch ${i + 1}/${batches.length}: ${batch.length} customers`);

    try {
      // Generate embeddings for batch
      const { embeddings } = await embedMany({
        model,
        values: batch.map((item) => item.text),
      });

      // Store embeddings
      for (let j = 0; j < batch.length; j++) {
        const buffer = embeddingToBuffer(new Float32Array(embeddings[j]));
        repository.customers.updateEmbedding(batch[j].id, buffer);
      }

      processedCount += batch.length;
      console.log(`   ✓ Processed ${processedCount}/${customersWithoutEmbeddings.length}`);
    } catch (error) {
      console.error(`   ✗ Batch failed:`, error instanceof Error ? error.message : error);
      errorCount += batch.length;
    }

    // Rate limiting: wait between batches
    if (i < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n✨ Embedding generation complete!`);
  console.log(`   ✅ Successful: ${processedCount} customers`);
  if (errorCount > 0) {
    console.log(`   ❌ Failed: ${errorCount} customers`);
  }
  console.log(`   ⏱️  Duration: ${duration}s`);
  console.log(`   📈 Rate: ${(processedCount / parseFloat(duration)).toFixed(1)} customers/sec`);

  console.log('\n💡 Next steps:');
  console.log('   1. Run segmentation: pnpm dev (then click "Run Segmentation")');
  console.log('   2. Or use the API: POST /api/intelligence/segment');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateEmbeddings()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Embedding generation failed:', error);
      process.exit(1);
    });
}

export { generateEmbeddings };
