# Speech Models (TTS)

Complete reference for OCI speech synthesis models.

## Available Models

### OCI TTS Standard

- **Model ID:** `oci-tts-standard`
- **Available Region:** `us-phoenix-1` only
- **Output Format:** MP3, WAV, PCM
- **Voices:** Multiple English voices

## Supported Voices

- `en-US-Standard-A` (Male)
- `en-US-Standard-B` (Female)
- `en-US-Standard-C` (Male)
- `en-US-Standard-D` (Female)
- And more regional variants

## Usage Examples

### Basic Text-to-Speech

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { generateSpeech } from 'ai';
import fs from 'node:fs';

const result = await generateSpeech({
  model: oci.speechModel('oci-tts-standard', {
    voice: 'en-US-Standard-A',
    region: 'us-phoenix-1',
  }),
  text: 'Hello, this is a test.',
});

// result.audio is a Buffer containing MP3 audio
fs.writeFileSync('output.mp3', result.audio);
```

### Custom Speed

```typescript
const result = await generateSpeech({
  model: oci.speechModel('oci-tts-standard', {
    voice: 'en-US-Standard-A',
    speed: 0.8, // Slower
    region: 'us-phoenix-1',
  }),
  text: 'Slow down, please...',
});
```

### Different Output Formats

```typescript
// MP3 (default)
const mp3Result = await generateSpeech({
  model: oci.speechModel('oci-tts-standard', {
    voice: 'en-US-Standard-A',
    format: 'mp3',
    region: 'us-phoenix-1',
  }),
  text: 'Text content',
});

// WAV
const wavResult = await generateSpeech({
  model: oci.speechModel('oci-tts-standard', {
    voice: 'en-US-Standard-A',
    format: 'wav',
    region: 'us-phoenix-1',
  }),
  text: 'Text content',
});
```

## Configuration Options

```typescript
const model = oci.speechModel('oci-tts-standard', {
  voice: 'en-US-Standard-A', // Voice selection
  speed: 1.0, // 0.5 to 2.0, default 1.0
  format: 'mp3', // 'mp3' | 'wav' | 'pcm'
  region: 'us-phoenix-1', // REQUIRED - speech only in Phoenix
});
```

## Important Notes

⚠️ **Speech services are ONLY available in `us-phoenix-1` region.**

You must explicitly set the region to `us-phoenix-1` in your speech model configuration.

## See Also

- [API Reference](./api-reference.md)
- [Configuration Guide](./configuration.md)
