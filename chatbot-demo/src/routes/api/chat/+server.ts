import { createOCI } from '@acedergren/oci-genai-provider';
import { streamText, convertToModelMessages, tool } from 'ai';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const provider = createOCI({
  compartmentId: process.env.OCI_COMPARTMENT_ID,
  region: process.env.OCI_REGION ?? 'eu-frankfurt-1',
});

// Test tools for demonstrating tool calling
const tools = {
  getWeather: tool({
    description: 'Get the current weather for a location',
    parameters: z.object({
      city: z.string().describe('The city name'),
      unit: z.enum(['celsius', 'fahrenheit']).optional().default('celsius'),
    }),
    execute: async ({ city, unit }) => {
      // Simulated weather data
      const temp = Math.floor(Math.random() * 30) + 5;
      const conditions = ['sunny', 'cloudy', 'rainy', 'partly cloudy'][
        Math.floor(Math.random() * 4)
      ];
      return {
        city,
        temperature: unit === 'fahrenheit' ? Math.round(temp * 1.8 + 32) : temp,
        unit,
        conditions,
        humidity: Math.floor(Math.random() * 50) + 30,
      };
    },
  }),
  calculateExpression: tool({
    description: 'Evaluate a mathematical expression',
    parameters: z.object({
      expression: z.string().describe('The math expression to evaluate, e.g., "2 + 2 * 3"'),
    }),
    execute: async ({ expression }) => {
      try {
        // Safe evaluation for simple math
        const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
        const result = Function(`"use strict"; return (${sanitized})`)();
        return { expression, result };
      } catch {
        return { expression, error: 'Invalid expression' };
      }
    },
  }),
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { messages, model } = await request.json();
    console.log('Received messages:', JSON.stringify(messages, null, 2));

    const result = streamText({
      model: provider.languageModel(model || 'meta.llama-3.3-70b-instruct'),
      messages: await convertToModelMessages(messages),
      tools,
      maxSteps: 5, // Allow multi-step tool usage
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
};
