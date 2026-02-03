# KYC Intelligence - Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- Node.js 18+ and pnpm installed
- OCI account with GenAI service enabled
- OCI credentials configured

## Step 1: Install Dependencies

```bash
cd kyc-intelligence
pnpm install
```

## Step 2: Configure OCI Credentials

Create `.env` file:

```bash
OCI_REGION=us-chicago-1
OCI_COMPARTMENT_ID=ocid1.compartment.oc1...
```

## Step 3: Choose Your Data Source

### Option A: Synthetic Data (Fastest)

Generate 200 realistic customer profiles:

```bash
pnpm seed
```

**Output**:
- 200 diverse customers
- Realistic income/occupation distributions
- Multiple geographic locations
- Various risk levels

### Option B: Kaggle Dataset (Most Realistic)

```bash
# Download dataset
kaggle datasets download -d sakshigoyal7/credit-card-customers
unzip credit-card-customers.zip -d data/

# Import (create import script first - see KAGGLE_INTEGRATION.md)
pnpm import-kaggle data/BankChurners.csv
```

## Step 4: Generate Embeddings

```bash
pnpm generate-embeddings
```

**What this does**:
1. Converts customer profiles to text
2. Calls OCI GenAI Cohere embeddings API
3. Stores 1024-dim vectors in database
4. Processes in batches (96 customers/batch)

**Estimated time**: ~30 seconds for 200 customers

## Step 5: Start the Dashboard

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173)

## Step 6: Run Segmentation

1. Click "🚀 Run Segmentation" button
2. Wait ~5 seconds for clustering
3. View generated segments with:
   - Segment names (e.g., "High-Income Tech Professionals")
   - Member counts
   - Descriptions
   - Risk profiles

## What Happens During Segmentation?

1. **K-means Clustering**: Groups customers by embedding similarity
2. **Characteristic Extraction**: Analyzes income, occupation, location, risk
3. **Automated Naming**: Generates descriptive segment names
4. **Database Storage**: Saves segments with member associations

## Architecture Flow

```
Customer Profile
    ↓
Convert to Text → "Customer: John Smith. Occupation: Software Engineer. Income: $120k..."
    ↓
Generate Embedding → [1024-dimensional vector]
    ↓
Store in Database → customers.profile_embedding (BLOB)
    ↓
Run Clustering → K-means (k=5, max_iterations=100)
    ↓
Create Segments → Extract characteristics & generate names
    ↓
Display Dashboard → View segments & members
```

## API Endpoints

### Get Stats
```bash
curl http://localhost:5173/api/intelligence/stats
```

### Get Segments
```bash
curl http://localhost:5173/api/intelligence/segments
```

### Run Segmentation
```bash
curl -X POST http://localhost:5173/api/intelligence/segment \
  -H "Content-Type: application/json" \
  -d '{"numSegments": 5}'
```

## Sample Output

```json
{
  "success": true,
  "result": {
    "totalCustomers": 200,
    "customersSegmented": 200,
    "segmentsCreated": 5,
    "executionTimeMs": 4832
  }
}
```

## Troubleshooting

### No customers in database
```bash
pnpm seed
```

### Missing embeddings
```bash
pnpm generate-embeddings
```

### Segmentation fails: "Not enough customers"
Minimum 20 customers required. Run `pnpm seed` to add more.

### OCI API errors
Check your credentials:
```bash
echo $OCI_REGION
echo $OCI_COMPARTMENT_ID
```

## Next Steps

- **View segment details**: Click on a segment card
- **Add more customers**: Run `pnpm seed 500` for 500 customers
- **Re-segment**: Click "Run Segmentation" again with new data
- **Export data**: Use API endpoints to export segment information
- **Integrate AI descriptions**: See README.md for Cohere Command R+ integration

## Performance Benchmarks

| Operation | Time (200 customers) |
|-----------|---------------------|
| Seed data | ~1 second |
| Generate embeddings | ~30 seconds |
| Run segmentation | ~5 seconds |
| Load dashboard | < 500ms |

## Cost Estimation

**OCI GenAI Usage**:
- Embeddings: 200 customers = ~$0.04 (cohere.embed-multilingual-v3.0)
- Segmentation: Runs locally (free)
- AI Descriptions (optional): ~$0.02 per segment (cohere.command-r-plus)

Total: **< $0.10** for 200 customers with basic segmentation

## Support

- 📚 Full documentation: `README.md`
- 🎯 Kaggle integration: `KAGGLE_INTEGRATION.md`
- 💬 Issues: Create an issue in the repo
