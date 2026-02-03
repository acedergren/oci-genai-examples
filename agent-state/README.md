# @acedergren/agent-state

SQLite-based state management for AI agent sessions and conversations.

## Features

- Session persistence with SQLite
- Turn-by-turn conversation storage
- Tool call tracking with results
- Token usage and cost tracking
- Type-safe schemas with Zod

## Installation

```bash
pnpm add @acedergren/agent-state
```

## Usage

```typescript
import { createConnection, createRepository } from '@acedergren/agent-state';

// Initialize database
const db = createConnection('./agent.db');
const repo = createRepository(db);

// Create a session
const session = repo.createSession({
  model: 'meta.llama-3.3-70b-instruct',
  region: 'us-chicago-1',
});

// Add a turn
const turn = repo.addTurn(session.id, {
  turnNumber: 1,
  userMessage: { role: 'user', content: 'Hello!' },
});

// Update with assistant response
repo.updateTurn(turn.id, {
  assistantResponse: { role: 'assistant', content: 'Hi there!' },
  tokensUsed: 150,
  costUsd: 0.0003,
});
```

## API

### Repository Methods

| Method | Description |
|--------|-------------|
| `createSession(data)` | Create a new session |
| `getSession(id)` | Get session by ID |
| `listSessions()` | List all sessions |
| `updateSession(id, data)` | Update session metadata |
| `deleteSession(id)` | Delete a session |
| `addTurn(sessionId, data)` | Add a conversation turn |
| `updateTurn(id, data)` | Update turn with response |
| `getSessionTurns(sessionId)` | Get all turns for a session |

### Schema

Sessions track:
- Model and region configuration
- Title and status
- Creation and update timestamps

Turns track:
- User message and assistant response
- Tool calls with arguments and results
- Token usage and cost
- Timing information

## License

MIT
