import { oci } from '@acedergren/oci-genai-provider';
import { embedMany, rerank } from 'ai';

async function main() {
  console.log('🔹 OCI Enhanced RAG Demo - Embeddings + Reranking\n');
  const documents = [
    'The Pacific Ocean is the largest ocean on Earth, covering more than 63 million square miles.',
    'Paris is the capital city of France, known for the Eiffel Tower and Louvre Museum.',
    'Python is a high-level programming language created by Guido van Rossum in 1991.',
    'The Amazon rainforest produces 20% of the Earth\'s oxygen and is home to millions of species.',
    'Machine learning is a subset of artificial intelligence that enables systems to learn from data.',
    'The Great Wall of China stretches over 13,000 miles and was built over many centuries.',
    'JavaScript is a programming language primarily used for web development and browser scripting.',
    'Mount Everest is the highest mountain on Earth at 29,032 feet above sea level.',
    'React is a JavaScript library for building user interfaces, developed by Facebook.',
    'The Nile River is often considered the longest river in the world at approximately 4,135 miles.',
  ];

  console.log('📚 Knowledge Base:');
  documents.forEach((doc, i) => console.log(`  ${i + 1}. ${doc.substring(0, 70)}...`));

  const query = 'What are some programming languages?';
  console.log(`\n🔍 Query: "${query}"\n`);

  console.log('Step 1: Initial retrieval with embeddings...');
  const embeddingModel = oci.embeddingModel('cohere.embed-multilingual-v3.0');

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: documents,
  });

  const { embedding: queryEmbedding } = await embedMany({
    model: embeddingModel,
    values: [query],
  }).then(result => ({ embedding: result.embeddings[0] }));

  const similarities = embeddings.map((docEmb) => cosineSimilarity(queryEmbedding, docEmb));
  const topK = 5;
  const candidateIndices = similarities.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score).slice(0, topK).map((item) => item.index);
  const candidates = candidateIndices.map((i) => documents[i]);

  console.log(`✅ Retrieved top ${topK} candidates:`);
  candidates.forEach((doc, i) => {
    const originalIndex = candidateIndices[i];
    console.log(`  ${i + 1}. [${(similarities[originalIndex] * 100).toFixed(1)}%] ${doc}`);
  });

  console.log('\nStep 2: Reranking candidates for precision...');
  const rerankingModel = oci.rerankingModel('cohere.rerank-v3.5');

  const { ranking } = await rerank({
    model: rerankingModel,
    query,
    documents: candidates,
    topN: 3,
  });

  console.log('✅ Reranked top 3 results:');
  ranking.forEach((rank, i) => {
    const doc = candidates[rank.index];
    console.log(`  ${i + 1}. [Score: ${rank.relevanceScore.toFixed(4)}] ${doc}`);
  });

  console.log('\n📊 Comparison:');
  console.log('  Embedding-only top result:', candidates[0].substring(0, 80) + '...');
  console.log('  After reranking:', candidates[ranking[0].index].substring(0, 80) + '...');
  console.log('\n✨ Reranking improves precision by understanding semantic relevance!');
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

main().catch(console.error);