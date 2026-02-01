# Speech-to-Text Demo

Demonstrates OCI Speech transcription using the AI SDK.

## Setup

```bash
pnpm install
```

## Usage

```bash
# Transcribe sample audio
pnpm start

# Transcribe custom audio file
pnpm start /path/to/audio.wav
```

## Supported Audio Formats

- WAV (recommended)
- MP3
- FLAC
- OGG
- M4A (Whisper only)
- WEBM (Whisper only)

## Models

- `oci.speech.standard` - Standard model (21 languages, custom vocabulary)
- `oci.speech.whisper` - Whisper model (99+ languages, no custom vocabulary)

## Custom Vocabulary

Add domain-specific terms for better accuracy:

```typescript
const model = oci.transcriptionModel("oci.speech.standard", {
  vocabulary: ["OpenCode", "GenAI", "Kubernetes"],
});
```

Note: Custom vocabulary only works with standard model.

