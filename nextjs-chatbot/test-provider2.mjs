import { createOCI } from '@acedergren/oci-genai-provider';
import { streamText } from 'ai';

const provider = createOCI({
  compartmentId: process.env.OCI_COMPARTMENT_ID,
  region: 'eu-frankfurt-1',
});

console.log('Testing OCI provider...');
console.log('Compartment ID:', process.env.OCI_COMPARTMENT_ID);

try {
  const result = await streamText({
    model: provider.languageModel('meta.llama-3.3-70b-instruct'),
    messages: [
      { role: 'user', content: 'Say "Hello World" and nothing else.' }
    ],
  });

  console.log('\n✅ StreamText call succeeded');
  console.log('Result object keys:', Object.keys(result));

  // Try to get the text stream
  const stream = result.textStream;
  console.log('\n📡 Reading stream...');

  let fullText = '';
  for await (const chunk of stream) {
    process.stdout.write(chunk);
    fullText += chunk;
  }

  console.log('\n\n✅ Full response:', fullText);
  console.log('\n✅ Provider test PASSED');

} catch (error) {
  console.error('\n❌ Provider test FAILED');
  console.error('Error:', error.message);
  if (error.cause) {
    console.error('Cause:', error.cause);
  }
  process.exit(1);
}
