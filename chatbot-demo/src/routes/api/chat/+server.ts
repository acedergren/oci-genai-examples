import { createOCI } from '@acedergren/oci-genai-provider';
import { streamText, convertToModelMessages } from 'ai';
import type { RequestHandler } from './$types';

const provider = createOCI({
  compartmentId: process.env.OCI_COMPARTMENT_ID,
  region: process.env.OCI_REGION ?? 'eu-frankfurt-1',
});

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { messages, model } = await request.json();
    console.log('Received messages:', JSON.stringify(messages, null, 2));

    const result = streamText({
      model: provider.languageModel(model || 'meta.llama-3.3-70b-instruct'),
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
};
