# KYC Intelligence Dashboard

AI-powered customer segmentation and intelligence platform built with SvelteKit, OCI GenAI, and the bioluminescence theme.

## Features

- 🧬 **Customer Embeddings**: Generate vector embeddings from customer profiles using OCI GenAI's Cohere embeddings
- 📊 **AI Segmentation**: Cluster customers using k-means with AI-generated segment descriptions
- 🔍 **Similar Customer Search**: Find customers with similar profiles using cosine similarity
- 🎯 **Personalized Recommendations**: AI-powered product recommendations based on segment characteristics
- 🌊 **Bioluminescence UI**: Beautiful ocean-themed interface with glowing animations

## Architecture

```
kyc-intelligence/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte           # App layout with header
│   │   ├── +page.svelte              # Main dashboard
│   │   └── api/
│   │       └── intelligence/
│   │           ├── stats/+server.ts  # GET customer stats
│   │           ├── segments/+server.ts # GET segments list
│   │           └── segment/+server.ts # POST run segmentation
│   ├── lib/
│   │   └── server/
│   │       └── db.ts                 # Database connection
│   └── app.css                       # Bioluminescence theme
└── package.json
```

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure OCI credentials** (`.env`):
   ```bash
   OCI_REGION=us-chicago-1
   OCI_COMPARTMENT_ID=ocid1.compartment.oc1...
   ```

3. **Seed sample data** (optional):
   Create sample customers with embeddings for testing.

4. **Start development server**:
   ```bash
   pnpm dev
   ```

5. **Open browser**:
   Navigate to `http://localhost:5173`

## Usage

### 1. View Dashboard
The main dashboard displays:
- Total customers and customers with embeddings
- Active segments
- Last segmentation timestamp

### 2. Run Segmentation
Click "Run Segmentation" to:
1. Cluster customers using k-means on their embeddings
2. Extract segment characteristics (income, occupation, location, risk)
3. Generate descriptive names and descriptions
4. Store segments in the database

### 3. View Segments
Each segment shows:
- Segment name (e.g., "High-Income Tech Professionals")
- Description and characteristics
- Member count
- Risk profile

## API Endpoints

### GET `/api/intelligence/stats`
Returns customer and segmentation statistics.

**Response**:
```json
{
  "totalCustomers": 150,
  "customersWithEmbeddings": 142,
  "activeSegments": 5,
  "lastSegmentation": "2/3/2026, 3:45:12 PM"
}
```

### GET `/api/intelligence/segments`
Returns all active customer segments.

**Response**:
```json
[
  {
    "id": "uuid",
    "name": "High-Income Tech Professionals",
    "description": "This segment contains 45 customers...",
    "member_count": 45,
    "risk_profile": "low",
    "characteristics": "{...}",
    "centroid_embedding": "..."
  }
]
```

### POST `/api/intelligence/segment`
Runs customer segmentation.

**Request**:
```json
{
  "numSegments": 5
}
```

**Response**:
```json
{
  "success": true,
  "result": {
    "totalCustomers": 150,
    "customersSegmented": 142,
    "segmentsCreated": 5,
    "executionTimeMs": 1234
  }
}
```

## Generating Embeddings

To generate embeddings for customers, use the `@acedergren/oci-genai-provider` package:

```typescript
import { embed } from 'ai';
import { createOCI } from '@acedergren/oci-genai-provider';
import { customerToEmbeddingText, embeddingToBuffer } from '@acedergren/kyc-platform/embeddings';

const oci = createOCI({ region: 'us-chicago-1' });
const model = oci.embeddingModel('cohere.embed-multilingual-v3.0');

async function generateEmbedding(customer) {
  const text = customerToEmbeddingText(customer);

  const { embedding } = await embed({
    model,
    value: text,
  });

  const buffer = embeddingToBuffer(new Float32Array(embedding));
  repository.customers.updateEmbedding(customer.id, buffer);
}
```

## AI-Enhanced Descriptions

To generate AI-powered segment descriptions using Cohere Command R+:

```typescript
import { generateText } from 'ai';
import { buildSegmentDescriptionPrompt } from '@acedergren/kyc-platform/segmentation';

const { text } = await generateText({
  model: oci.languageModel('cohere.command-r-plus'),
  prompt: buildSegmentDescriptionPrompt(
    segment.name,
    characteristics,
    sampleCustomers
  ),
  temperature: 0.7,
  maxTokens: 1000,
});

// Update segment description in database
```

## Technology Stack

- **Frontend**: SvelteKit 2.50 + Svelte 5 + Tailwind CSS 4
- **Backend**: SvelteKit server routes
- **Database**: SQLite + Drizzle ORM (via kyc-platform)
- **AI**: OCI GenAI (Cohere embeddings & Command R+)
- **AI SDK**: Vercel AI SDK 6.0
- **Theme**: Custom bioluminescence design

## Next Steps

1. **Add customer detail pages**: View individual customer profiles and their segment memberships
2. **Implement search**: Find similar customers using vector search
3. **Add filters**: Filter segments by risk, size, characteristics
4. **Export functionality**: Export segment data for analysis
5. **AI recommendations**: Generate personalized product recommendations

## License

Private - part of oci-genai-examples monorepo
