# OCI Realtime Speech-to-Text Demo

A SvelteKit web application demonstrating real-time speech transcription using OCI's WebSocket-based realtime speech service.

## Features

- Browser microphone capture via `getUserMedia()`
- Real-time transcription display with partial/final highlighting
- Language selector (English, Spanish, French, German, etc.)
- Model toggle (Oracle vs Whisper)
- Start/Stop recording controls
- Copy transcript to clipboard
- Error handling with user-friendly messages

## Architecture

This demo consists of two parts:

1. **Frontend (this package)**: SvelteKit app that captures audio from the browser microphone
2. **Backend**: Required to proxy WebSocket connections to OCI (browser cannot directly connect due to CORS)

### Why a Backend is Required

OCI's realtime speech service uses:
- JWT token authentication via REST API call
- WebSocket connection to `wss://realtime.aiservice.{region}.oci.oraclecloud.com`

Browsers cannot:
- Make authenticated OCI REST calls (credentials should not be exposed)
- Connect to arbitrary WebSocket endpoints (CORS restrictions)

### Backend Options

1. **Node.js Server**: Use the `@acedergren/oci-genai-provider` package
2. **Cloudflare Workers**: Proxy WebSocket connections
3. **AWS Lambda + API Gateway**: Serverless WebSocket proxy

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- OCI account with Speech service access

### Installation

```bash
# From monorepo root
pnpm install

# Run the demo
cd examples/realtime-stt-demo
pnpm dev
```

### Demo Mode

This demo includes a simulation mode that demonstrates the UI without requiring an OCI backend. The actual audio is captured but transcription results are simulated.

To connect to real OCI service, you'll need to:

1. Set up a backend WebSocket proxy
2. Update the `startRecording` function to connect to your backend
3. Forward audio data through the WebSocket

## Usage Example (with Backend)

```typescript
import { OCIRealtimeTranscription } from '@acedergren/oci-genai-provider';

// Server-side code
const session = new OCIRealtimeTranscription({
  region: 'us-phoenix-1',
  compartmentId: process.env.OCI_COMPARTMENT_ID,
});

session.on('partial', (result) => {
  // Send to frontend via WebSocket
  ws.send(JSON.stringify({ type: 'partial', ...result }));
});

session.on('final', (result) => {
  // Send to frontend via WebSocket
  ws.send(JSON.stringify({ type: 'final', ...result }));
});

await session.connect({ language: 'en-US', model: 'ORACLE' });

// When receiving audio from frontend
ws.on('message', (data) => {
  session.sendAudio(data);
});
```

## Supported Languages

### Oracle Model
- en-US (English - United States)
- en-GB (English - Great Britain)
- en-AU (English - Australia)
- en-IN (English - India)
- es-ES (Spanish - Spain)
- fr-FR (French - France)
- de-DE (German - Germany)
- it-IT (Italian - Italy)
- pt-BR (Portuguese - Brazil)
- hi-IN (Hindi - India)

### Whisper Model
- 100+ languages with auto-detection support

## License

Apache-2.0
