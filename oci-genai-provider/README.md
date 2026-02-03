# @acedergren/oci-genai-provider

Oracle Cloud Infrastructure (OCI) Generative AI provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs).

Complete ProviderV3 implementation supporting language models, embeddings, speech synthesis, transcription, and reranking.

## Works with Any Vercel AI SDK Application

This provider implements the Vercel AI SDK's `ProviderV3` interface, which means it works with:

- ✅ **Next.js** - App Router and Pages Router
- ✅ **Remix** - Streaming and non-streaming
- ✅ **SvelteKit** - Any SvelteKit app
- ✅ **Express/Fastify** - Node.js servers
- ✅ **OpenCode** - Terminal and Desktop (with optional integration package)
- ✅ **Any Framework** - If it uses Vercel AI SDK, it works

**No special setup required** - just install and use like any other AI SDK provider.

> 💡 **Using OpenCode?** Check out [@acedergren/oci-genai-provider](../opencode-integration) for a convenient integration package with config helpers and model presets.

## Features

- **5+ Model Types** - Language models, embeddings, speech, transcription, reranking
- **16+ Language Models** - Cohere Command, Meta Llama, Anthropic Claude, Mistral, Grok
- **3 Embedding Models** - Multilingual and English semantic search
- **Speech Models (TTS)** - OCI Speech Synthesis in Phoenix region
- **Transcription Models (STT)** - OCI Speech to Text services
- **Reranking Models** - Cohere Rerank for search optimization
- **Streaming Support** - Full streaming for language models
- **Type Safety** - Complete TypeScript definitions
- **Auth Flexibility** - Config file, instance principal, resource principal

## Why Use OCI GenAI?

| Feature                | OCI GenAI               | Other Providers |
| ---------------------- | ----------------------- | --------------- |
| **EU Data Residency**  | ✅ Frankfurt, Stockholm | Limited         |
| **Grok Models**        | ✅ xAI Grok 4           | ❌              |
| **Cost**               | 💰 Competitive          | Varies          |
| **Context Window**     | Up to 1M tokens         | Up to 2M tokens |
| **Enterprise Support** | ✅ Oracle Cloud         | Varies          |

## Installation

```bash
npm install @acedergren/oci-genai-provider ai
```

Or with pnpm:

```bash
pnpm add @acedergren/oci-genai-provider ai
```

Or with yarn:

```bash
yarn add @acedergren/oci-genai-provider ai
```

## Quick Start

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { generateText } from 'ai';

const result = await generateText({
  model: oci.languageModel('cohere.command-r-plus'),
  prompt: 'Explain quantum computing in simple terms',
});

console.log(result.text);
```

## Feature Support

This provider supports most Vercel AI SDK v6 features for text generation. See [FEATURES.md](./FEATURES.md) for complete details.

### Supported ✅

- Streaming and non-streaming generation
- Temperature, topP, topK, penalties
- Seed parameter (best-effort determinism)
- Multiple model families (Llama, Gemini, Cohere, Grok)
- Retry logic and timeout control
- Tool/function calling (selected models)
- Multi-modal input - vision (Gemini models)
- Reasoning modes (Grok, Gemini, Cohere models)

### Not Supported ❌

- Audio and document inputs
- JSON mode (pending AI SDK integration)

For detailed information on each feature, see [FEATURES.md](./FEATURES.md).

## Authentication

### Option 1: OCI Config File (Recommended)

Create `~/.oci/config`:

```ini
[DEFAULT]
user=ocid1.user.oc1..aaa...
fingerprint=12:34:56:78:...
key_file=~/.oci/oci_api_key.pem
tenancy=ocid1.tenancy.oc1..aaa...
region=us-phoenix-1
```

Set environment variables:

```bash
export OCI_CONFIG_PROFILE=DEFAULT
export OCI_COMPARTMENT_ID=ocid1.compartment.oc1..aaa...
```

### Option 2: Explicit Configuration

```typescript
import { createOCI } from '@acedergren/oci-genai-provider';

const provider = createOCI({
  region: 'us-phoenix-1',
  compartmentId: 'ocid1.compartment.oc1..aaa...',
  profile: 'DEFAULT',
});

const model = provider.languageModel('cohere.command-r-plus');
```

### Option 3: Instance Principal (OCI Compute)

```typescript
const provider = createOCI({
  auth: 'instance_principal',
  region: 'us-phoenix-1',
});
```

See [Configuration Guide](./docs/configuration.md) for complete authentication documentation.

## Language Models

Generate text using powerful language models from multiple providers.

### Available Models

| Model ID                         | Family    | Context | Best For              |
| -------------------------------- | --------- | ------- | --------------------- |
| `cohere.command-r-plus`          | Cohere    | 128K    | Long context, RAG     |
| `cohere.command-r`               | Cohere    | 128K    | General purpose       |
| `meta.llama-3.3-70b-instruct`    | Meta      | 8K      | Instruction following |
| `meta.llama-3.1-405b-instruct`   | Meta      | 128K    | Most capable          |
| `anthropic.claude-3-5-sonnet-v2` | Anthropic | 200K    | Analysis, coding      |
| `mistral.mistral-large-2`        | Mistral   | 128K    | Multilingual          |
| `xai.grok-4`                     | xAI       | 131K    | Most capable          |

[See full model list in API Reference](./docs/api-reference.md)

### Usage

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { streamText } from 'ai';

const result = streamText({
  model: oci.languageModel('cohere.command-r-plus'),
  messages: [{ role: 'user', content: 'Write a poem about clouds' }],
  temperature: 0.7,
  maxTokens: 500,
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### Deterministic Generation

Use the seed parameter for more consistent outputs (best-effort):

```typescript
const result = await model.doGenerate({
  prompt: [{ role: 'user', content: [{ type: 'text', text: 'Generate a random story' }] }],
  seed: 42,
  temperature: 0.7,
});

// Repeated calls with same seed produce similar (not identical) results
```

See [Language Models Documentation](./docs/language-models.md) for complete reference.

## Speech-to-Text Transcription

Convert audio files to text using OCI Speech:

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { transcribe } from 'ai';
import { readFileSync } from 'fs';

const audioData = readFileSync('audio.wav');

const { text } = await transcribe({
  model: oci.transcriptionModel('oci.speech.standard', {
    language: 'en-US',
    vocabulary: ['OpenCode', 'GenAI'],
  }),
  audioData,
});

console.log('Transcript:', text);
```

### Available Transcription Models

| Model ID              | Languages | Custom Vocabulary | Formats                        | Use Case                 |
| --------------------- | --------- | ----------------- | ------------------------------ | ------------------------ |
| `oci.speech.standard` | 21        | ✅ Yes            | WAV, MP3, FLAC, OGG            | Production transcription |
| `oci.speech.whisper`  | 99+       | ❌ No             | WAV, MP3, FLAC, OGG, M4A, WEBM | Multilingual support     |

### Transcription Options

```typescript
oci.transcriptionModel('oci.speech.standard', {
  language: 'en-US',
  vocabulary: ['term1'],
});
```

### Supported Languages

21+ languages including: English (US/UK/AU/IN), Spanish, Portuguese, French, German, Italian, Japanese, Korean, Chinese, Dutch, Polish, Russian, Turkish, Hindi, Arabic.

## Embeddings

Generate text embeddings for semantic search, clustering, and RAG applications.

### Available Embedding Models

| Model ID                          | Dimensions | Max Batch | Use Case                     |
| --------------------------------- | ---------- | --------- | ---------------------------- |
| `cohere.embed-multilingual-v3.0`  | 1024       | 96        | Multilingual semantic search |
| `cohere.embed-english-v3.0`       | 1024       | 96        | English semantic search      |
| `cohere.embed-english-light-v3.0` | 384        | 96        | Fast English embeddings      |

### Usage

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { embed, embedMany } from 'ai';

// Single embedding
const { embedding } = await embed({
  model: oci.embeddingModel('cohere.embed-multilingual-v3.0'),
  value: 'Hello world',
});

// Batch embeddings (up to 96 texts)
const { embeddings } = await embedMany({
  model: oci.embeddingModel('cohere.embed-multilingual-v3.0'),
  values: ['Text 1', 'Text 2', 'Text 3'],
});
```

See [Embeddings Documentation](./docs/embeddings.md) for complete reference.

## Speech Models (TTS)

Generate speech from text using OCI Speech services.

### Usage

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { generateSpeech } from 'ai';

const result = await generateSpeech({
  model: oci.speechModel('oci-tts-standard', {
    voice: 'en-US-Standard-A',
    region: 'us-phoenix-1', // Speech only in Phoenix
  }),
  text: 'Hello, this is a test.',
});

// result.audio is a Buffer containing MP3 audio
```

**Note:** Speech services are only available in the `us-phoenix-1` region.

See [Speech Models Documentation](./docs/speech.md) for complete reference.

## Transcription Models (STT)

Convert speech to text using OCI Speech to Text services.

### Usage

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { transcribe } from 'ai';
import { readFileSync } from 'fs';

const audioBuffer = readFileSync('./audio.mp3');

const result = await transcribe({
  model: oci.transcriptionModel('oci-stt-standard', {
    language: 'en',
    region: 'us-phoenix-1',
  }),
  audio: audioBuffer,
});

console.log(result.text);
```

**Note:** Transcription services are only available in the `us-phoenix-1` region.

See [Transcription Models Documentation](./docs/transcription.md) for complete reference.

## Reranking Models

Improve search results with semantic reranking.

### Usage

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { rerank } from 'ai';

const { ranking } = await rerank({
  model: oci.rerankingModel('cohere.rerank-v3.5'),
  query: 'What is quantum computing?',
  documents: [
    'Quantum computing uses qubits...',
    'Classical computers use bits...',
    'Machine learning is a subset...',
  ],
  topN: 2,
});

// ranking contains indices and relevance scores
console.log(ranking); // Top 2 most relevant documents
```

See [Reranking Models Documentation](./docs/reranking.md) for complete reference.

## Regional Availability

| Service             | Available Regions     |
| ------------------- | --------------------- |
| Language Models     | All OCI regions       |
| Embeddings          | All OCI regions       |
| Speech (TTS)        | **us-phoenix-1 only** |
| Transcription (STT) | **us-phoenix-1 only** |
| Reranking           | All OCI regions       |

Supported regions include: `us-phoenix-1`, `us-ashburn-1`, `eu-frankfurt-1`, `eu-stockholm-1`, `uk-london-1`, `ap-tokyo-1`, `ap-mumbai-1`, and more.

## Error Handling

The provider includes specific error classes for different failure scenarios:

```typescript
import {
  OCIGenAIError,
  NetworkError,
  RateLimitError,
  AuthenticationError,
  ModelNotFoundError,
} from '@acedergren/oci-genai-provider';

try {
  const result = await generateText({ model, prompt: 'Hello\!' });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Retry after ${error.retryAfterMs}ms`);
  } else if (error instanceof NetworkError) {
    console.log(`Network error: ${error.code}`);
  } else if (error instanceof AuthenticationError) {
    console.log(`Auth failed: ${error.message}`);
  } else if (error instanceof ModelNotFoundError) {
    console.log(`Invalid model: ${error.modelId}`);
  }
}
```

## Examples

Complete working examples in `examples/` directory:

- **[chatbot-demo](../../examples/chatbot-demo/)** - SvelteKit chatbot with streaming
- **[nextjs-chatbot](../../examples/nextjs-chatbot/)** - Next.js chatbot
- **[rag-demo](../../examples/rag-demo/)** - RAG with embeddings
- **[speech-demo](../../examples/speech-demo/)** - Text-to-speech
- **[transcription-demo](../../examples/transcription-demo/)** - Speech-to-text
- **[rag-reranking-demo](../../examples/rag-reranking-demo/)** - RAG with embeddings + reranking

## Migration from v1.x

v2.0 introduces ProviderV3 support with breaking changes. See [Migration Guide](./docs/migration.md) for detailed upgrade instructions.

### Quick Migration

```typescript
// v1.x (deprecated)
import { oci } from '@acedergren/oci-genai-provider';
const model = oci('cohere.command-r-plus'); // ❌ No longer supported

// v2.0 (ProviderV3)
import { oci } from '@acedergren/oci-genai-provider';
const model = oci.languageModel('cohere.command-r-plus'); // ✅ Use this
```

## Troubleshooting

### Common Issues

**Authentication Error**

```
Error: Authentication failed
```

Solution: Verify your OCI config file and ensure `OCI_COMPARTMENT_ID` is set.

**Region Not Available for Speech**

```
Error: Speech services not available in this region
```

Solution: Use `us-phoenix-1` region for speech/transcription services.

**Model Not Found**

```
Error: Invalid model ID
```

Solution: Check [available models](./docs/api-reference.md) for correct model IDs.

See [Troubleshooting Guide](./docs/troubleshooting.md) for more solutions.

## Documentation

- [API Reference](./docs/api-reference.md) - Complete API documentation
- [Language Models](./docs/language-models.md) - Language model reference
- [Embeddings](./docs/embeddings.md) - Embedding models reference
- [Speech Models](./docs/speech.md) - Speech synthesis reference
- [Transcription Models](./docs/transcription.md) - Speech-to-text reference
- [Reranking Models](./docs/reranking.md) - Reranking reference
- [Configuration Guide](./docs/configuration.md) - Configuration and authentication
- [Migration Guide](./docs/migration.md) - Upgrade from v1.x to v2.0
- [Troubleshooting Guide](./docs/troubleshooting.md) - Common issues and solutions

## TypeScript

Full type safety:

```typescript
import type { OCIConfig, ModelMetadata } from '@acedergren/oci-genai-provider';

const config: OCIConfig = {
  region: 'us-phoenix-1',
  auth: 'config_file',
  compartmentId: 'ocid1.compartment.oc1..test',
};
```

## Testing

### Running Tests

```bash
# All tests
pnpm test

# With coverage
pnpm test:coverage

# Watch mode
pnpm test:watch

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration
```

### Coverage

We maintain 80%+ test coverage across:

- Language models
- Embedding models
- Speech models (TTS)
- Transcription models (STT)
- Reranking models

View coverage report:

```bash
pnpm test:coverage
open coverage/lcov-report/index.html
```

### Contributing Tests

See [Testing Guide](../../docs/testing-guide.md) for detailed information on:

- Writing unit tests
- Writing integration tests
- Using test helpers and mocks
- Test fixtures and best practices

## Development

This package is part of a monorepo. For contributors:

```bash
# Clone the monorepo
git clone https://github.com/acedergren/opencode-oci-genai.git
cd opencode-oci-genai

# Install dependencies (requires pnpm 8+)
pnpm install

# Build this package
pnpm --filter @acedergren/oci-genai-provider build

# Run tests
pnpm --filter @acedergren/oci-genai-provider test

# Run tests in watch mode
pnpm --filter @acedergren/oci-genai-provider test -- --watch
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup and guidelines.

## License

MIT

## Support

- GitHub Issues: [opencode-oci-genai/issues](https://github.com/acedergren/opencode-oci-genai/issues)
- Documentation: [docs/](./docs/)
- Examples: [examples/](../../examples/)
