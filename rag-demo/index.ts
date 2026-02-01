import { oci } from '@acedergren/oci-genai-provider';
import { embed, embedMany } from 'ai';

async function main() {
  console.log('🔹 OCI Embedding Demo - Simple RAG\n');

  // Sample documents
  const documents = [
    'The capital of France is Paris.',
    'Python is a popular programming language.',
    'The Pacific Ocean is the largest ocean.',
    'Claude is an AI assistant made by Anthropic.',
  ];

  console.log('📚 Documents:');
  documents.forEach((doc, i) => console.log(`  ${i + 1}. ${doc}`));

  // Create embedding model
  const embeddingModel = oci.embeddingModel('cohere.embed-multilingual-v3.0');

  console.log('\n🧮 Generating embeddings...');

  // Embed all documents
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: documents,
  });

  console.log(`✅ Generated ${embeddings.length} embeddings`);
  console.log(`   Dimensions: ${embeddings[0].length}`);

  // Query
  const query = 'What is the largest ocean?';
  console.log(`\n🔍 Query: "${query}"`);

  // Embed query
  const { embedding: queryEmbedding } = await embed({
    model: embeddingModel,
    value: query,
  });

  // Find most similar (cosine similarity)
  const similarities = embeddings.map((docEmb) =>
    cosineSimilarity(queryEmbedding, docEmb)
  );

  const bestMatch = similarities.indexOf(Math.max(...similarities));

  console.log('\n📊 Results:');
  documents.forEach((doc, i) => {
    console.log(`  ${i + 1}. [${(similarities[i] * 100).toFixed(1)}%] ${doc}`);
  });

  console.log(`\n🎯 Best match: "${documents[bestMatch]}"`);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

main().catch(console.error);
