# Kaggle Setup Guide - Step by Step

Complete guide to import **10,127 real customer records** from Kaggle.

## Step 1: Install Kaggle CLI

```bash
# Using pip
pip install kaggle

# Or using conda
conda install -c conda-forge kaggle
```

**Verify installation**:
```bash
kaggle --version
```

## Step 2: Set Up Kaggle API Credentials

1. **Go to Kaggle**:
   - Visit https://www.kaggle.com/account
   - Log in to your account

2. **Create API Token**:
   - Scroll to "API" section
   - Click "Create New API Token"
   - This downloads `kaggle.json`

3. **Install credentials**:
   ```bash
   # Create Kaggle directory
   mkdir -p ~/.kaggle

   # Move downloaded token (adjust path if needed)
   mv ~/Downloads/kaggle.json ~/.kaggle/

   # Set permissions (IMPORTANT!)
   chmod 600 ~/.kaggle/kaggle.json
   ```

4. **Verify credentials**:
   ```bash
   kaggle datasets list --max-size 1000
   ```

## Step 3: Download Dataset

```bash
# Navigate to project root
cd /Users/acedergr/Projects/oci-genai-examples/kyc-intelligence

# Create data directory
mkdir -p data

# Download Credit Card Customers dataset (10,127 customers)
kaggle datasets download -d sakshigoyal7/credit-card-customers

# Unzip
unzip credit-card-customers.zip -d data/

# Clean up zip
rm credit-card-customers.zip
```

**Expected result**:
```
data/
  └── BankChurners.csv (1.8 MB, 10,127 rows)
```

## Step 4: Verify Dataset

```bash
# Check file exists
ls -lh data/BankChurners.csv

# View first few rows
head -n 3 data/BankChurners.csv
```

**Expected columns**:
- CLIENTNUM, Attrition_Flag, Customer_Age, Gender
- Education_Level, Marital_Status, Income_Category
- Card_Category, Credit_Limit, Total_Trans_Amt, Total_Trans_Ct
- And 15+ more fields

## Step 5: Install Dependencies

```bash
# Install project dependencies (includes csv-parse)
pnpm install
```

## Step 6: Import Dataset

```bash
# Import all customers from Kaggle dataset
pnpm import-kaggle data/BankChurners.csv
```

**Expected output**:
```
📥 Importing Kaggle Credit Card Customers dataset

   File: data/BankChurners.csv
   Reading CSV file...
   ✓ Found 10127 records

📊 Importing customers...

   Progress: 5000/10127 (5000 imported, 0 skipped)
   Progress: 10000/10127 (10000 imported, 0 skipped)

✨ Import complete!

📊 Results:
   ✅ Imported: 10127 customers
   ⏭️  Skipped: 0 duplicates

📈 Dataset Statistics:
   Total customers: 10127
   Average income: $62,458

   Risk Distribution:
     critical: 1627 (16.1%)
     high: 2534 (25.0%)
     low: 2831 (27.9%)
     medium: 3135 (31.0%)

   KYC Status Distribution:
     flagged: 2154 (21.3%)
     in_progress: 245 (2.4%)
     rejected: 813 (8.0%)
     verified: 6915 (68.3%)

💡 Next steps:
   1. Generate embeddings: pnpm generate-embeddings
   2. Start dashboard: pnpm dev
   3. Run segmentation: Click "Run Segmentation" button
```

## Step 7: Set Up OCI Credentials

Create `.env` file:
```bash
# In kyc-intelligence directory
cat > .env << 'EOF'
OCI_REGION=us-chicago-1
OCI_COMPARTMENT_ID=ocid1.compartment.oc1...
EOF
```

**Get your OCI credentials**:
1. Log in to OCI Console
2. Note your region (e.g., `us-chicago-1`)
3. Get compartment OCID from Identity > Compartments

## Step 8: Generate Embeddings

```bash
# Generate embeddings for all 10,127 customers
pnpm generate-embeddings
```

**This will**:
- Convert customer profiles to text
- Call OCI GenAI Cohere embeddings API
- Process in batches of 96 customers
- Store 1024-dim vectors in database

**Expected output**:
```
🧬 Generating customer embeddings...

📊 Found 10127 customers without embeddings
📊 0 customers already have embeddings

🔗 Using model: cohere.embed-multilingual-v3.0
🌍 Region: us-chicago-1

📦 Processing 106 batches...

   Batch 1/106: 96 customers
   ✓ Processed 96/10127
   Batch 2/106: 96 customers
   ✓ Processed 192/10127
   ...
   Batch 106/106: 31 customers
   ✓ Processed 10127/10127

✨ Embedding generation complete!
   ✅ Successful: 10127 customers
   ⏱️  Duration: 245.3s
   📈 Rate: 41.3 customers/sec
```

**Estimated time**: ~4-5 minutes for 10,127 customers
**Estimated cost**: ~$2.00 USD (10,127 × $0.0002)

## Step 9: Start Dashboard

```bash
pnpm dev
```

Open: http://localhost:5173

## Step 10: Run Segmentation

1. **View Dashboard**:
   - Total Customers: 10,127
   - With Embeddings: 10,127
   - Active Segments: 0

2. **Click "🚀 Run Segmentation"**:
   - Wait ~30 seconds
   - Algorithm: K-means (k=5, max_iter=100)

3. **View Results**:
   - 5 customer segments created
   - Each with name, description, member count
   - Risk profiles per segment

**Expected segments**:
- High-Income Professionals (2,800 customers)
- Middle-Income Families (2,400 customers)
- Budget-Conscious Workers (1,900 customers)
- Recent Graduates (1,500 customers)
- High-Risk Customers (1,527 customers)

## Troubleshooting

### Issue: Kaggle credentials not found
```bash
# Check credentials exist
ls -la ~/.kaggle/kaggle.json

# If missing, download from https://www.kaggle.com/account
# Then: mv ~/Downloads/kaggle.json ~/.kaggle/ && chmod 600 ~/.kaggle/kaggle.json
```

### Issue: Dataset download fails
```bash
# Try with full dataset name
kaggle datasets download sakshigoyal7/credit-card-customers

# Or download manually:
# 1. Visit: https://www.kaggle.com/datasets/sakshigoyal7/credit-card-customers
# 2. Click "Download" button
# 3. Unzip to data/ folder
```

### Issue: CSV not found
```bash
# Check file location
find . -name "BankChurners.csv"

# If in different location, specify path:
pnpm import-kaggle path/to/BankChurners.csv
```

### Issue: OCI credentials error
```bash
# Verify credentials are set
echo $OCI_REGION
echo $OCI_COMPARTMENT_ID

# If empty, add to .env file or export:
export OCI_REGION=us-chicago-1
export OCI_COMPARTMENT_ID=ocid1.compartment.oc1...
```

### Issue: Embedding generation fails
```bash
# Test OCI connection
curl -X POST "https://inference.generativeai.${OCI_REGION}.oci.oraclecloud.com" \
  -H "Content-Type: application/json"

# Check if embeddings exist
pnpm tsx -e "import { getDatabase, createRepository } from '@acedergren/kyc-platform'; \
  const db = getDatabase(); const repo = createRepository(db.getConnection()); \
  const withEmb = repo.customers.list().filter(c => c.profile_embedding); \
  console.log('With embeddings:', withEmb.length)"
```

### Issue: Segmentation fails - "Not enough customers"
Minimum 20 customers with embeddings required.

Check:
```bash
# Count customers with embeddings
pnpm tsx -e "import { getDatabase, createRepository } from '@acedergren/kyc-platform'; \
  const db = getDatabase(); const repo = createRepository(db.getConnection()); \
  console.log('With embeddings:', repo.customers.list().filter(c => c.profile_embedding).length)"
```

If zero, run: `pnpm generate-embeddings`

## Cost Breakdown

**OCI GenAI Costs (10,127 customers)**:

| Service | Model | Usage | Cost per 1K | Total |
|---------|-------|-------|-------------|-------|
| Embeddings | cohere.embed-multilingual-v3.0 | 10,127 customers | $0.20 | **$2.03** |
| Segmentation | (runs locally) | N/A | Free | **$0.00** |
| AI Descriptions (optional) | cohere.command-r-plus | 5 segments × 800 tokens | $3.00 / 1M tokens | **$0.01** |

**Total**: ~$2.04 for complete setup

## What You Get

**10,127 Real Customer Profiles**:
- Age: 26-73 years
- Income: $15k-$250k
- Credit limits: $1.4k-$34k
- Transaction history: 10-139 transactions/year
- Multiple card types: Blue, Silver, Gold, Platinum
- Education levels: High School to Doctorate
- Geographic diversity: 15 major US cities

**Realistic Segments**:
- Based on actual spending patterns
- Real credit utilization rates
- Authentic demographic distributions
- Production-quality test data

## Next Steps

After successful import:

1. **Explore Segments**: Click on segment cards to view details
2. **Find Similar Customers**: Build search feature
3. **AI Descriptions**: Enhance with Cohere Command R+
4. **Export Data**: Use API for integration
5. **Build Other Use Cases**: Onboarding, Service, Prospecting

## Alternative Datasets

Want different data? Try these:

**Bank Churn** (10,000 customers):
```bash
kaggle datasets download -d shantanudhakadd/bank-customer-churn-prediction
pnpm import-kaggle data/Churn_Modelling.csv  # Requires custom mapping
```

**Loan Prediction** (614 customers):
```bash
kaggle datasets download -d altruistdelhite04/loan-prediction-problem-dataset
```

**Customer Personality** (2,240 customers):
```bash
kaggle datasets download -d imakash3011/customer-personality-analysis
```

## Support

- 📚 **Full API docs**: `README.md`
- 🚀 **Quick start**: `QUICK_START.md`
- 💬 **Issues**: GitHub Issues
- 📊 **Dataset source**: https://www.kaggle.com/datasets/sakshigoyal7/credit-card-customers

---

**Ready?** Start with Step 1 above! 🚀
