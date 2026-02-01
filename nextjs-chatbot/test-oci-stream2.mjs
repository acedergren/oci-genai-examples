import { createOCI } from '@acedergren/oci-genai-provider';
import { streamText } from 'ai';

const provider = createOCI({
  compartmentId: process.env.OCI_COMPARTMENT_ID,
  region: 'eu-frankfurt-1',
});

console.log('Testing toTextStreamResponse()...\n');

const result = await streamText({
  model: provider.languageModel('meta.llama-3.3-70b-instruct'),
  messages: [{ role: 'user', content: 'Say hello' }],
});

const response = result.toTextStreamResponse();

console.log('Response type:', response.constructor.name);
console.log('Response status:', response.status);
console.log('Response headers:');
for (const [key, value] of response.headers.entries()) {
  console.log(`  ${key}: ${value}`);
}

console.log('\nReading response body...');
const reader = response.body.getReader();
const decoder = new TextDecoder();

let fullText = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  process.stdout.write(chunk);
  fullText += chunk;
}

console.log('\n\n✅ Response body read successfully');
console.log('Full text length:', fullText.length);
