# Feature Support Matrix

This document provides a comprehensive overview of AI SDK v6 features and their support status in the OCI GenAI Provider.

## Fully Supported Features

### Core Text Generation

✅ **Streaming and Non-Streaming Generation**
- Both `streamText()` and `generateText()` are fully supported
- Streaming uses Server-Sent Events (SSE) for real-time token delivery
- Non-streaming returns complete responses in a single API call

✅ **Temperature Control**
- Range: 0.0 to 1.0
- Controls randomness in output generation
- Lower values = more deterministic, higher values = more creative

✅ **Max Tokens**
- Controls maximum length of generated response
- Supported across all model families
- Default and maximum values vary by model

✅ **Top-P (Nucleus Sampling)**
- Range: 0.0 to 1.0
- Cumulative probability threshold for token selection
- Alternative to temperature for controlling randomness

✅ **Top-K Sampling**
- Integer value limiting candidate tokens
- Not all models support this parameter
- Works with COHERE-formatted models

✅ **Presence Penalty**
- Range: -2.0 to 2.0
- Reduces likelihood of repeating any tokens
- Encourages topic diversity

✅ **Frequency Penalty**
- Range: -2.0 to 2.0
- Reduces likelihood based on token frequency
- Discourages repetition of common phrases

### Advanced Parameters

✅ **Seed Parameter (Best-Effort Determinism)**
- Supported as of v0.7.0
- Enables reproducible outputs with same inputs
- ⚠️ **Important**: OCI provides **best-effort** determinism only
- Determinism is NOT guaranteed across:
  - Different API versions
  - Backend infrastructure changes
  - Model updates or redeployments
- Use cases: Testing, debugging, demonstrations
- **Not recommended** for production workflows requiring strict reproducibility

✅ **Stop Sequences**
- Custom sequences to halt generation
- Multiple stop sequences supported
- Useful for structured output formats

### Message Formats

✅ **System Messages**
- Set behavior and context for the model
- Properly formatted in API requests
- Can be combined with user/assistant messages

✅ **User Messages**
- Standard user input messages
- Support for multi-turn conversations
- Text content fully supported

✅ **Assistant Messages**
- Model's previous responses in conversation
- Required for multi-turn dialogue
- Maintains conversation context

✅ **Multi-Turn Conversations**
- Full conversation history supported
- Proper message ordering maintained
- Context window limitations apply per model

### Model Families

✅ **Meta Llama Models**
- Llama 3.3, 3.2, 3.1, 3
- GENERIC format (OpenAI-compatible)
- Available in Frankfurt region

✅ **Google Gemini Models**
- Gemini 2.0 Flash
- GENERIC format (OpenAI-compatible)
- Available in Frankfurt region

✅ **Cohere Command Models**
- Command R, Command R+, Command R7B
- COHERE format (native Cohere API)
- Available in Frankfurt, Ashburn, Phoenix regions

✅ **xAI Grok Models**
- Grok 2.0
- GENERIC format (OpenAI-compatible)
- Available in Frankfurt region

### Provider Features

✅ **Error Handling**
- Structured error responses
- HTTP status code mapping
- Detailed error messages from OCI

✅ **Retry Logic**
- Configurable maximum retries
- Exponential backoff (2x multiplier)
- Initial delay of 2 seconds

✅ **Request Timeout**
- Default: 60 seconds
- Configurable per request
- Applies to both streaming and non-streaming

✅ **Usage Tracking**
- Prompt tokens counted
- Completion tokens counted
- Total tokens reported
- Available in response metadata

## Not Supported (OCI Limitations)

### Tool Calling / Function Calling

❌ **Not Supported**
- OCI GenAI does not support function calling
- No native tool use capabilities
- Workarounds:
  - Implement tool calling in application layer
  - Use prompt engineering for structured outputs
  - Consider RAG for knowledge augmentation

### Multi-Modal Capabilities

✅ **Vision / Image Understanding**
- Supported by Gemini 2.5 models (Flash and Pro)
- Handles image URLs and base64 encoded images
- Multi-modal prompts combining text and images

❌ **Audio Processing**
- No audio input support
- No audio output generation
- For speech: Use separate Speech service (see `stt-demo` example)

❌ **Document Understanding**
- No native PDF/document parsing
- Text must be extracted before sending to model
- Consider pre-processing pipeline for documents

### Advanced Content Types

✅ **Reasoning / Chain-of-Thought Modes**
- Supported by Grok 4/4.1 Fast Reasoning models
- Supported by Gemini 2.5 models (Flash and Pro)
- Supported by Cohere Command A Reasoning models
- Extended thinking capabilities for complex problem-solving

❌ **Citations / Source Attribution**
- No native citation support
- RAG implementations can add citations manually
- See `rag-demo` and `rag-reranking-demo` for patterns

❌ **Structured Output Guarantees**
- No schema-enforced JSON output
- JSON mode is under investigation (see Partial Support section)
- Use prompt engineering + parsing for structured data

## Partially Supported / Future Enhancements

### Response Format (JSON Mode)

⚠️ **Status: Blocked by AI SDK**
- OCI API supports response format hints
- AI SDK v6 doesn't expose `responseFormat` parameter to providers
- Waiting for AI SDK enhancement
- Tracked in AI SDK discussions
- Workaround: Use system prompts requesting JSON output

### Abort Signal

⚠️ **Status: Unclear Functionality**
- AI SDK passes `AbortSignal` to providers
- OCI SDK does not document abort behavior
- Signal is passed through but effect is uncertain
- Further investigation needed
- Use request timeout as alternative

### Custom HTTP Headers

⚠️ **Status: Limited Applicability**
- OCI SDK handles authentication headers internally
- Custom headers may not be needed for most use cases
- Could be relevant for:
  - Custom logging/tracing
  - Load balancer routing
  - Future OCI features
- Not currently prioritized

## Regional Model Availability

### Frankfurt (`eu-frankfurt-1`)

**GENERIC Format:**
- Meta Llama 3.3 70B Instruct
- Meta Llama 3.2 3B Instruct
- Meta Llama 3.1 405B Instruct
- Meta Llama 3.1 70B Instruct
- Meta Llama 3 70B Instruct
- Google Gemini 2.0 Flash
- xAI Grok 2.0

**COHERE Format:**
- Cohere Command R
- Cohere Command R+
- Cohere Command R7B

### Ashburn (`us-ashburn-1`)

**COHERE Format:**
- Cohere Command R
- Cohere Command R+

### Phoenix (`us-phoenix-1`)

**COHERE Format:**
- Cohere Command R
- Cohere Command R+

## API Format Differences

The OCI GenAI service supports two API formats:

### GENERIC Format (OpenAI-compatible)

Used by: Llama, Gemini, Grok models

```typescript
{
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  max_tokens: 500,
  top_p: 0.9,
  presence_penalty: 0.0,
  frequency_penalty: 0.0,
  seed: 12345
}
```

### COHERE Format (Native Cohere)

Used by: Cohere Command models

```typescript
{
  message: 'Hello!',           // Current user message
  chat_history: [              // Previous conversation
    { role: 'USER', message: 'Hi' },
    { role: 'CHATBOT', message: 'Hello!' }
  ],
  temperature: 0.7,
  max_tokens: 500,
  p: 0.9,                      // Equivalent to top_p
  k: 50,                       // Equivalent to top_k
  frequency_penalty: 0.0,
  presence_penalty: 0.0,
  seed: 12345
}
```

The provider automatically selects the correct format based on model family.

## Usage Examples

### Basic Text Generation

```typescript
import { createOCI } from '@acedergren/oci-genai-provider';
import { generateText } from 'ai';

const oci = createOCI({
  compartmentId: process.env.OCI_COMPARTMENT_ID!,
  region: 'eu-frankfurt-1',
});

const result = await generateText({
  model: oci('meta.llama-3.3-70b-instruct'),
  prompt: 'Explain quantum computing in simple terms.',
  temperature: 0.7,
  maxTokens: 500,
});

console.log(result.text);
```

### Deterministic Generation with Seed

```typescript
import { streamText } from 'ai';

const result = await streamText({
  model: oci('meta.llama-3.3-70b-instruct'),
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Count from 1 to 5.' }
  ],
  seed: 42,  // Best-effort determinism
  temperature: 0.3,  // Lower temperature helps consistency
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### Streaming with Timeout

```typescript
import { streamText } from 'ai';

const result = await streamText({
  model: oci('cohere.command-r-plus', {
    timeout: 30000,  // 30 second timeout
  }),
  prompt: 'Write a short story about a robot.',
  temperature: 0.8,
  maxTokens: 1000,
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## Testing

All supported features have test coverage:

- **Unit Tests**: Mock OCI API responses, verify parameter mapping
- **Integration Tests**: Live OCI API calls (requires valid credentials)
- **Error Tests**: Verify error handling for various failure scenarios

Run tests:

```bash
pnpm test                    # All tests
pnpm test:unit              # Unit tests only
pnpm test:integration       # Integration tests (requires OCI config)
```

## Roadmap

### Short Term
- ✅ Seed parameter support (completed v0.7.0)
- 🔄 Investigate JSON mode via system prompts
- 🔄 Clarify abort signal behavior with OCI SDK team

### Medium Term
- Monitor AI SDK for `responseFormat` parameter support
- Explore custom header use cases
- Add examples for advanced parameter combinations

### Long Term
- Track OCI GenAI service for new capabilities
- Evaluate multi-modal support if/when available
- Consider tool calling emulation patterns

## Contributing

When adding new features:

1. Check OCI GenAI API documentation for support
2. Add implementation to provider code
3. Add tests (unit + integration if applicable)
4. Update this document
5. Add usage example to examples directory

## Resources

- [OCI GenAI Documentation](https://docs.oracle.com/en-us/iaas/Content/generative-ai/home.htm)
- [AI SDK v6 Documentation](https://sdk.vercel.ai/docs)
- [Provider Source Code](./src)
- [Example Applications](../../examples)

---

**Last Updated**: 2026-01-29
