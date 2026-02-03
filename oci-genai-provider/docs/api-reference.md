# API Reference

Complete API documentation for `@acedergren/oci-genai-provider`.

## Provider Factory

### createOCI(config?: OCIBaseConfig): OCIProvider

Creates a new OCI provider instance with custom configuration.

**Parameters:**

- `config` (optional): Base configuration object

**Returns:** `OCIProvider` instance

**Example:**

```typescript
import { createOCI } from '@acedergren/oci-genai-provider';

const provider = createOCI({
  region: 'us-phoenix-1',
  compartmentId: 'ocid1.compartment.oc1..aaa...',
});
```

### oci: OCIProvider

Default provider instance using environment variables or OCI config file.

**Example:**

```typescript
import { oci } from '@acedergren/oci-genai-provider';

const model = oci.languageModel('cohere.command-r-plus');
```

## OCIProvider Class

### languageModel(modelId: string, settings?: OCILanguageModelSettings): LanguageModelV3

Creates a language model instance.

**Parameters:**

- `modelId`: Model identifier (e.g., 'cohere.command-r-plus')
- `settings` (optional): Language model configuration

**Returns:** `LanguageModelV3` instance

**Example:**

```typescript
const model = oci.languageModel('cohere.command-r-plus', {
  requestOptions: {
    timeoutMs: 60000,
  },
});
```

### embeddingModel(modelId: string, settings?: OCIEmbeddingSettings): EmbeddingModelV3

Creates an embedding model instance.

**Parameters:**

- `modelId`: Embedding model identifier (e.g., 'cohere.embed-multilingual-v3.0')
- `settings` (optional): Embedding configuration

**Returns:** `EmbeddingModelV3` instance

**Example:**

```typescript
const model = oci.embeddingModel('cohere.embed-multilingual-v3.0', {
  truncate: 'END',
  inputType: 'DOCUMENT',
});
```

### speechModel(modelId: string, settings?: OCISpeechSettings): SpeechModelV3

Creates a speech synthesis model instance.

**Parameters:**

- `modelId`: Speech model identifier (e.g., 'oci-tts-standard')
- `settings` (optional): Speech configuration

**Returns:** `SpeechModelV3` instance

**Example:**

```typescript
const model = oci.speechModel('oci-tts-standard', {
  voice: 'en-US-Standard-A',
  speed: 1.0,
  region: 'us-phoenix-1',
});
```

### transcriptionModel(modelId: string, settings?: OCITranscriptionSettings): TranscriptionModelV3

Creates a speech-to-text model instance.

**Parameters:**

- `modelId`: Transcription model identifier (e.g., 'oci-stt-standard')
- `settings` (optional): Transcription configuration

**Returns:** `TranscriptionModelV3` instance

### rerankingModel(modelId: string, settings?: OCIRerankingSettings): RerankingModelV3

Creates a reranking model instance.

**Parameters:**

- `modelId`: Reranking model identifier (e.g., 'cohere.rerank-v3.0')
- `settings` (optional): Reranking configuration

**Returns:** `RerankingModelV3` instance

## Configuration Types

### OCIBaseConfig

Base configuration for OCI provider.

```typescript
interface OCIBaseConfig {
  region?: string; // Default: eu-frankfurt-1
  compartmentId?: string; // Optional (can use OCI_COMPARTMENT_ID env var)
  profile?: string; // Default: DEFAULT
  auth?: 'config_file' | 'instance_principal' | 'resource_principal';
  configPath?: string; // Default: ~/.oci/config
  endpoint?: string; // For custom endpoints
}
```

### OCILanguageModelSettings

Settings for language models.

```typescript
interface OCILanguageModelSettings extends OCIBaseConfig {
  requestOptions?: {
    timeoutMs?: number;
    retry?: {
      enabled?: boolean;
      maxRetries?: number;
    };
  };
}
```

### OCIEmbeddingSettings

Settings for embedding models.

```typescript
interface OCIEmbeddingSettings extends OCIBaseConfig {
  truncate?: 'START' | 'END' | 'NONE';
  inputType?: 'QUERY' | 'DOCUMENT';
  dimensions?: number; // 384 or 1024
}
```

### OCISpeechSettings

Settings for speech synthesis.

```typescript
interface OCISpeechSettings extends OCIBaseConfig {
  voice?: string;
  speed?: number; // 0.5 to 2.0
  format?: 'mp3' | 'wav' | 'pcm';
}
```

### OCITranscriptionSettings

Settings for transcription.

```typescript
interface OCITranscriptionSettings extends OCIBaseConfig {
  language?: string; // ISO 639-1 code
  profileName?: string;
}
```

### OCIRerankingSettings

Settings for reranking.

```typescript
interface OCIRerankingSettings extends OCIBaseConfig {
  topN?: number;
}
```

## Error Classes

### OCIGenAIError

Base error class for all OCI GenAI errors.

```typescript
class OCIGenAIError extends Error {
  readonly retryable: boolean;
  readonly statusCode?: number;
}
```

### RateLimitError

Thrown when rate limited (429).

```typescript
class RateLimitError extends OCIGenAIError {
  readonly retryAfterMs?: number;
}
```

### AuthenticationError

Thrown when authentication fails (401).

```typescript
class AuthenticationError extends OCIGenAIError {
  readonly authType: string;
}
```

### NetworkError

Thrown on network failures.

```typescript
class NetworkError extends OCIGenAIError {
  readonly code?: string;
}
```

### ModelNotFoundError

Thrown when model is not found (404).

```typescript
class ModelNotFoundError extends OCIGenAIError {
  readonly modelId: string;
}
```

## Model IDs

### Language Models

- `xai.grok-4`
- `xai.grok-4-fast-reasoning`
- `xai.grok-4-fast-non-reasoning`
- `xai.grok-4-1-fast-reasoning`
- `xai.grok-4-1-fast-non-reasoning`
- `xai.grok-code-fast-1`
- `xai.grok-3`
- `xai.grok-3-fast`
- `xai.grok-3-mini`
- `xai.grok-3-mini-fast`
- `meta.llama-4-maverick-17b-128e-instruct-fp8`
- `meta.llama-4-scout-17b-16e-instruct`
- `meta.llama-3.3-70b-instruct`
- `meta.llama-3.2-90b-vision-instruct`
- `meta.llama-3.2-11b-vision-instruct`
- `meta.llama-3.1-405b-instruct`
- `meta.llama-3.1-70b-instruct`
- `google.gemini-2.5-pro`
- `google.gemini-2.5-flash`
- `google.gemini-2.5-flash-lite`
- `cohere.command-a-03-2025`
- `cohere.command-a-vision`
- `cohere.command-a-reasoning`
- `cohere.command-plus-latest`
- `cohere.command-latest`
- `cohere.command-r-plus-08-2024`
- `cohere.command-r-08-2024`
- `cohere.command-r-plus`
- `cohere.command-r-16k`
- `openai.gpt-oss-120b`
- `openai.gpt-oss-20b`

### Embedding Models

- `cohere.embed-multilingual-v3.0`
- `cohere.embed-english-v3.0`
- `cohere.embed-english-light-v3.0`

### Speech Models

- `oci-tts-standard`

### Transcription Models

- `oci-stt-standard`

### Reranking Models

- `cohere.rerank-v3.0`

## See Also

- [Configuration Guide](./configuration.md)
- [Language Models](./language-models.md)
- [Embeddings](./embeddings.md)
- [Speech Models](./speech.md)
- [Transcription Models](./transcription.md)
- [Reranking Models](./reranking.md)

## Quick Reference

Provider methods:

- **languageModel()** - Create language model instances
- **embeddingModel()** - Create embedding model instances
- **speechModel()** - Create speech synthesis model instances
- **transcriptionModel()** - Create transcription model instances
- **rerankingModel()** - Create reranking model instances
