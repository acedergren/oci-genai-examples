# KYC Intelligence Dashboard

AI-powered customer segmentation and intelligence platform built with SvelteKit, OCI GenAI, and enterprise-grade design.

## Features

- 🧬 **Customer Embeddings**: Generate 1024-dimensional vector embeddings from customer profiles using OCI GenAI's Cohere embed-multilingual-v3.0
- 📊 **AI Segmentation**: Cluster customers using k-means++ with AI-generated segment descriptions
- 🔍 **Similar Customer Search**: Find customers with similar profiles using cosine similarity on embeddings
- 🎯 **Personalized Recommendations**: AI-powered product recommendations based on segment characteristics
- 📈 **Interactive Dashboard**: Enterprise UI with sorting, filtering, progress bars, and risk visualizations
- 🎮 **Architecture Playground**: Interactive HTML explainer for customer demonstrations
- 🔄 **Real-time Updates**: Live progress tracking during segmentation operations

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

1. **Install dependencies** (from monorepo root):
   ```bash
   pnpm install
   ```

2. **Build the kyc-platform package**:
   ```bash
   cd kyc-platform && pnpm build && cd ..
   ```

3. **Configure OCI credentials** (create `kyc-intelligence/.env`):
   ```bash
   OCI_REGION=us-chicago-1
   OCI_COMPARTMENT_ID=ocid1.compartment.oc1...
   ```

4. **Seed sample data** (optional but recommended):
   ```bash
   cd kyc-intelligence
   pnpm tsx scripts/seed-data.ts
   ```
   This creates 200 sample customers with realistic profiles and generates embeddings for all.

5. **Start development server**:
   ```bash
   cd kyc-intelligence
   pnpm dev
   ```

6. **Open browser**:
   Navigate to `http://localhost:5175` (or the port shown in terminal)

## Usage

### 1. View Dashboard
The enterprise dashboard displays:
- **Key Metrics**: Total customers, customers with embeddings (with progress bar), active segments
- **Segment Cards**: All segments with member counts, descriptions, and characteristics
- **Risk Distribution**: Visual breakdown of risk profiles (low, medium, high, critical)
- **Sorting Options**: Sort segments by size, income, or risk level

### 2. Run Segmentation
Click "Run Segmentation" to:
1. Cluster customers using k-means++ initialization on their 1024-dim embeddings
2. Assign each customer to nearest centroid using cosine similarity
3. Extract segment characteristics (avg income, occupations, locations, risk profiles)
4. Generate AI-powered descriptive names and descriptions using Cohere Command R+
5. Store segments with centroid embeddings in the database
6. View real-time progress during execution

### 3. View Segments
Each enterprise segment card shows:
- **Segment Name**: AI-generated descriptive name (e.g., "High-Income Tech Professionals")
- **Description**: Rich description with business insights
- **Member Count**: Total customers in segment with percentage badge
- **Average Income**: Formatted currency value
- **Risk Profile**: Color-coded badge (success/warning/error)
- **Risk Distribution**: Visual bar chart showing risk breakdown
- **Key Characteristics**: Occupations, locations, income levels

### 4. Interactive Sorting
Sort segments dynamically by:
- **Size**: Most members first
- **Income**: Highest average customer value first
- **Risk**: Most critical segments first

### 5. Architecture Playground
Open `architecture-playground.html` in a browser to explore:
- Interactive component architecture diagram
- Technology stack details
- Data flow visualization
- Component relationships and layers
- Copy-paste ready descriptions for customer demos

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

- **Frontend**: SvelteKit 2.50 + Svelte 5 (runes) + Tailwind CSS 4
- **Backend**: SvelteKit server routes (REST API)
- **Database**: SQLite + Drizzle ORM (via @acedergren/kyc-platform)
- **AI**: OCI GenAI
  - Embeddings: cohere.embed-multilingual-v3.0 (1024-dim vectors)
  - Generation: cohere.command-r-plus (segment descriptions)
  - Clustering: K-means++ with cosine similarity
- **AI SDK**: Vercel AI SDK 6.0
- **Design System**:
  - Enterprise color palette with semantic tokens
  - Fluid typography using CSS clamp()
  - Container queries for component-level responsiveness
  - Custom badge, button, and metric components
  - Smooth animations and transitions
  - Professional data visualizations

## Project Status

✅ **Phase 1 Complete** - KYC Intelligence foundation:
- Database schema with embeddings support
- Embeddings pipeline (cohere.embed-multilingual-v3.0)
- K-means++ clustering segmentation
- Enterprise-grade responsive dashboard
- Interactive architecture playground
- 200 customers seeded with embeddings
- Real-time segmentation execution

## Next Steps (Phase 2+)

According to the implementation plan:

### Phase 2: Customer Service Management (Weeks 3-4)
- RAG knowledge base with embeddings + reranking
- Streaming chat API with sentiment analysis
- Ticket routing and classification
- Agent dashboard + customer chat widget

### Phase 3: Customer Onboarding (Weeks 5-6)
- Multi-step onboarding wizard
- Document upload + OCR extraction
- Compliance validation with AI reasoning
- Manual review queue

### Phase 4: Client Prospecting (Weeks 7-8)
- Lead import wizard
- AI lead scoring engine
- Personalized pitch generation
- Analytics dashboard

## Potential Enhancements for Phase 1

1. **Customer Detail Pages**: View individual customer profiles and segment memberships
2. **Vector Search**: Find similar customers using cosine similarity on embeddings
3. **Advanced Filters**: Filter segments by risk, size, income ranges, occupations
4. **Export Functionality**: Export segment data as CSV/JSON for analysis
5. **AI Recommendations**: Generate personalized product recommendations per segment
6. **Segment Comparison**: Side-by-side comparison of multiple segments
7. **Time-Series Analysis**: Track segment evolution over time

## License

Private - part of oci-genai-examples monorepo
