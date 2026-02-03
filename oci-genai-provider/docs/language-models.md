# Language Models

Complete reference for OCI language models.

## Available Models

All language models support streaming and tool calling.

### Cohere Models

#### Command R Plus

- **Model ID:** `cohere.command-r-plus`
- **Context Window:** 128,000 tokens
- **Best For:** Long context, RAG, document analysis
- **Cost:** Mid-range

#### Command R

- **Model ID:** `cohere.command-r-08-2024`
- **Context Window:** 128,000 tokens
- **Best For:** General purpose, instruction following
- **Cost:** Lower

### Meta Llama Models

#### Llama 3.3 70B

- **Model ID:** `meta.llama-3.3-70b-instruct`
- **Context Window:** 8,192 tokens
- **Best For:** Instruction following, coding
- **Cost:** Lower

#### Llama 3.1 405B

- **Model ID:** `meta.llama-3.1-405b-instruct`
- **Context Window:** 128,000 tokens
- **Best For:** Most complex tasks, longest context
- **Cost:** Higher

### Anthropic Claude Models

#### Claude 3.5 Sonnet

- **Model ID:** `anthropic.claude-3-5-sonnet-v2`
- **Context Window:** 200,000 tokens
- **Best For:** Analysis, coding, complex reasoning
- **Cost:** Mid-range

### Mistral Models

#### Mistral Large

- **Model ID:** `mistral.mistral-large-2`
- **Context Window:** 128,000 tokens
- **Best For:** Multilingual, instruction following
- **Cost:** Lower

### xAI Grok Models

#### Grok 4

- **Model ID:** `xai.grok-4`
- **Context Window:** 131,072 tokens
- **Best For:** Most capable, longest context
- **Cost:** Higher

## Usage Examples

### Basic Text Generation

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { generateText } from 'ai';

const result = await generateText({
  model: oci.languageModel('cohere.command-r-plus'),
  prompt: 'Explain quantum computing',
});

console.log(result.text);
```

### Streaming Text

```typescript
import { streamText } from 'ai';

const result = await streamText({
  model: oci.languageModel('cohere.command-r-plus'),
  prompt: 'Write a poem about clouds',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### Conversation

```typescript
const result = await generateText({
  model: oci.languageModel('cohere.command-r-plus'),
  messages: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi\! How can I help?' },
    { role: 'user', content: 'What is AI?' },
  ],
});
```

### Temperature Control

```typescript
// Creative responses
const creative = await generateText({
  model: oci.languageModel('cohere.command-r-plus'),
  prompt: 'Write a story...',
  temperature: 1.0, // Higher = more creative
});

// Focused responses
const focused = await generateText({
  model: oci.languageModel('cohere.command-r-plus'),
  prompt: 'Summarize this text...',
  temperature: 0.2, // Lower = more focused
});
```

### Tool Calling

Tool calling allows models to invoke external functions. Supported models:
- **Cohere:** Command R, Command R+
- **Meta Llama:** 3.1+, 3.2+, 3.3+
- **xAI:** Grok models
- **Google:** Gemini models

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: oci.languageModel('cohere.command-r-plus'),
  prompt: "What's the weather in London?",
  tools: {
    weather: tool({
      description: 'Get current weather for a location',
      parameters: z.object({
        city: z.string().describe('City name'),
        unit: z.enum(['celsius', 'fahrenheit']).optional(),
      }),
      execute: async ({ city, unit = 'celsius' }) => {
        // Call your weather API
        return { temperature: 15, condition: 'cloudy', city, unit };
      },
    }),
  },
});

// The model may call the weather tool
console.log(result.text);
console.log(result.toolCalls); // Array of tool calls made
console.log(result.toolResults); // Results from tool executions
```

### Tool Calling with Streaming

```typescript
import { streamText, tool } from 'ai';
import { z } from 'zod';

const result = streamText({
  model: oci.languageModel('meta.llama-3.3-70b-instruct'),
  prompt: 'Search for the latest news about AI',
  tools: {
    search: tool({
      description: 'Search the web',
      parameters: z.object({
        query: z.string(),
      }),
      execute: async ({ query }) => {
        // Your search implementation
        return { results: ['Article 1', 'Article 2'] };
      },
    }),
  },
});

for await (const part of result.fullStream) {
  if (part.type === 'text-delta') {
    process.stdout.write(part.textDelta);
  } else if (part.type === 'tool-call') {
    console.log('Tool called:', part.toolName, part.args);
  } else if (part.type === 'tool-result') {
    console.log('Tool result:', part.result);
  }
}
```

### Multi-Turn Tool Conversations

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';

// First turn: model decides to call a tool
const turn1 = await generateText({
  model: oci.languageModel('cohere.command-r-plus'),
  messages: [
    { role: 'user', content: "What's the weather like in Paris and Tokyo?" },
  ],
  tools: {
    weather: tool({
      description: 'Get weather for a city',
      parameters: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ temp: 20, city }),
    }),
  },
  maxSteps: 3, // Allow multiple tool call rounds
});

// With maxSteps, the SDK handles the tool call loop automatically
console.log(turn1.text); // Final response after tool calls
```

## See Also

- [API Reference](./api-reference.md)
- [Configuration Guide](./configuration.md)
