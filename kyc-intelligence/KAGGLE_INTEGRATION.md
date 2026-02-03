# Kaggle Dataset Integration Guide

Quick guide for importing real customer datasets from Kaggle.

## Recommended Datasets

1. **Credit Card Customers** - [kaggle.com/datasets/sakshigoyal7/credit-card-customers](https://www.kaggle.com/datasets/sakshigoyal7/credit-card-customers)
   - 10,127 customers with spending behavior

2. **Bank Customer Churn** - [kaggle.com/datasets/shantanudhakadd/bank-customer-churn-prediction](https://www.kaggle.com/datasets/shantanudhakadd/bank-customer-churn-prediction)
   - 10,000 customers with account details

3. **Customer Personality Analysis** - [kaggle.com/datasets/imakash3011/customer-personality-analysis](https://www.kaggle.com/datasets/imakash3011/customer-personality-analysis)
   - 2,240 customers with behavioral data

## Quick Start

```bash
# 1. Install Kaggle CLI
pip install kaggle

# 2. Download dataset
kaggle datasets download -d sakshigoyal7/credit-card-customers
unzip credit-card-customers.zip -d data/

# 3. Create import script (see example below)
# 4. Import data
pnpm import-kaggle data/BankChurners.csv

# 5. Generate embeddings
pnpm generate-embeddings
```

## Example Import Script

See `scripts/import-kaggle-example.ts` for a complete implementation.

For detailed instructions, mapping examples, and troubleshooting, see the full guide in this file.
