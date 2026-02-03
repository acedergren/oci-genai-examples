# Fraud Analyst Agent

AI-powered financial fraud analysis application with OCI GenAI.

## Features

- **Transaction Analysis** - Analyze transactions for fraud indicators
- **Risk Scoring** - ML-based risk assessment
- **Pattern Detection** - Identify suspicious patterns
- **Interactive Dashboard** - D3.js visualizations
- **Demo Database** - Seeded with realistic test data

## Prerequisites

- Node.js 18+
- pnpm 8+
- OCI CLI configured

## Quick Start

```bash
cd fraud-analyst-agent
pnpm install

# Initialize database with demo data
pnpm db:reset

# Start development server
pnpm dev
```

Open http://localhost:5173

## Database

Uses SQLite with Drizzle ORM:

```bash
# Generate migrations
pnpm db:generate

# Run migrations
pnpm db:migrate

# Open Drizzle Studio
pnpm db:studio

# Reset with fresh seed data
pnpm db:reset
```

## Architecture

```
fraud-analyst-agent/
├── src/
│   ├── routes/           # SvelteKit routes
│   ├── lib/
│   │   ├── components/   # Svelte components
│   │   ├── db/           # Drizzle schema
│   │   └── services/     # Business logic
│   └── app.css           # Tailwind styles
├── scripts/
│   └── seed.ts           # Database seeding
└── drizzle.config.ts
```

## Testing

```bash
# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Coverage report
pnpm test:coverage
```

## License

MIT
