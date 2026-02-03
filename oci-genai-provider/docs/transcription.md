# Transcription Models (STT)

Complete reference for OCI speech-to-text models.

## Available Models

### OCI STT Standard

- **Model ID:** `oci-stt-standard`
- **Available Region:** `us-phoenix-1` only
- **Supported Languages:** English, Spanish, Portuguese, Hindi, French, German, Italian
- **Input Formats:** WAV, MP3, FLAC, OGG

## Supported Languages

- `en`, `en-US`, `en-GB`, `en-AU`, `en-IN` - English (multiple variants)
- `es`, `es-ES` - Spanish
- `pt-BR` - Portuguese (Brazil)
- `hi-IN` - Hindi
- `fr`, `fr-FR` - French
- `de`, `de-DE` - German
- `it`, `it-IT` - Italian
- `auto` - Auto-detect language

## Usage Examples

### Basic Transcription

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

### From File

```typescript
import { createReadStream } from 'fs';

const audioStream = createReadStream('./meeting.wav');
const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
  const chunks: Buffer[] = [];
  audioStream.on('data', chunk => chunks.push(chunk));
  audioStream.on('end', () => resolve(Buffer.concat(chunks)));
  audioStream.on('error', reject);
});

const result = await transcribe({
  model: oci.transcriptionModel('oci-stt-standard', {
    language: 'en',
    region: 'us-phoenix-1',
  }),
  audio: audioBuffer,
});
```

### Different Languages

```typescript
const spanishAudio = readFileSync('./spanish_audio.mp3');

const result = await transcribe({
  model: oci.transcriptionModel('oci-stt-standard', {
    language: 'es', // Spanish
    region: 'us-phoenix-1',
  }),
  audio: spanishAudio,
});
```

## Configuration Options

```typescript
const model = oci.transcriptionModel('oci-stt-standard', {
  language: 'en', // ISO 639-1 language code
  region: 'us-phoenix-1', // REQUIRED - transcription only in Phoenix
  profileName: 'default', // Optional profile
});
```

## Important Notes

⚠️ **Transcription services are ONLY available in `us-phoenix-1` region.**

You must explicitly set the region to `us-phoenix-1` in your transcription model configuration.

## See Also

- [API Reference](./api-reference.md)
- [Configuration Guide](./configuration.md)
