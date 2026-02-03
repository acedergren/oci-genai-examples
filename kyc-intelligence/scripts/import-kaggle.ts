// scripts/import-kaggle.ts
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { getDatabase, createRepository } from '@acedergren/kyc-platform';
import type { Customer } from '@acedergren/kyc-platform';

/**
 * Import customer data from Kaggle Credit Card Customers dataset
 * Dataset: https://www.kaggle.com/datasets/sakshigoyal7/credit-card-customers
 */

interface CreditCardCustomer {
  CLIENTNUM: string;
  Attrition_Flag: string;
  Customer_Age: number;
  Gender: 'M' | 'F';
  Dependent_count: number;
  Education_Level: string;
  Marital_Status: string;
  Income_Category: string;
  Card_Category: string;
  Months_on_book: number;
  Total_Relationship_Count: number;
  Months_Inactive_12_mon: number;
  Contacts_Count_12_mon: number;
  Credit_Limit: number;
  Total_Revolving_Bal: number;
  Avg_Open_To_Buy: number;
  Total_Amt_Chng_Q4_Q1: number;
  Total_Trans_Amt: number;
  Total_Trans_Ct: number;
  Total_Ct_Chng_Q4_Q1: number;
  Avg_Utilization_Ratio: number;
}

// Income category to actual income range
const INCOME_MAP: Record<string, [number, number]> = {
  'Less than $40K': [25000, 39999],
  '$40K - $60K': [40000, 60000],
  '$60K - $80K': [60000, 80000],
  '$80K - $120K': [80000, 120000],
  '$120K +': [120000, 250000],
  'Unknown': [40000, 60000], // Default to middle income
};

// Education level to occupation mapping
const EDUCATION_OCCUPATIONS: Record<string, string[]> = {
  'Uneducated': ['Retail Worker', 'Restaurant Server', 'Warehouse Associate'],
  'High School': ['Retail Manager', 'Customer Service Rep', 'Administrative Assistant'],
  'College': ['Account Executive', 'Marketing Specialist', 'Operations Manager', 'Sales Manager'],
  'Graduate': ['Financial Analyst', 'Business Consultant', 'Senior Manager', 'Project Manager'],
  'Post-Graduate': ['Software Engineer', 'Data Analyst', 'Director', 'Senior Consultant'],
  'Doctorate': ['Data Scientist', 'Research Director', 'Professor', 'Chief Analyst'],
  'Unknown': ['Business Professional', 'Consultant', 'Specialist'],
};

// Education level to employer mapping
const EDUCATION_EMPLOYERS: Record<string, string[]> = {
  'Uneducated': ['Local Business', 'Retail Chain', 'Restaurant Group'],
  'High School': ['Target', 'Walmart', 'Bank of America', 'Local Company'],
  'College': ['Salesforce', 'Deloitte', 'IBM', 'Accenture', 'PwC'],
  'Graduate': ['Google', 'Microsoft', 'Amazon', 'Goldman Sachs', 'JP Morgan'],
  'Post-Graduate': ['Meta', 'Apple', 'McKinsey', 'Boston Consulting Group'],
  'Doctorate': ['Stanford University', 'MIT', 'Harvard', 'Research Lab'],
  'Unknown': ['Various Companies', 'Mid-Size Corporation', 'Private Firm'],
};

// Cities for geographic distribution
const CITIES = [
  { city: 'New York', state: 'NY', country: 'USA' },
  { city: 'Los Angeles', state: 'CA', country: 'USA' },
  { city: 'Chicago', state: 'IL', country: 'USA' },
  { city: 'Houston', state: 'TX', country: 'USA' },
  { city: 'Phoenix', state: 'AZ', country: 'USA' },
  { city: 'Philadelphia', state: 'PA', country: 'USA' },
  { city: 'San Antonio', state: 'TX', country: 'USA' },
  { city: 'San Diego', state: 'CA', country: 'USA' },
  { city: 'Dallas', state: 'TX', country: 'USA' },
  { city: 'San Francisco', state: 'CA', country: 'USA' },
  { city: 'Austin', state: 'TX', country: 'USA' },
  { city: 'Seattle', state: 'WA', country: 'USA' },
  { city: 'Denver', state: 'CO', country: 'USA' },
  { city: 'Boston', state: 'MA', country: 'USA' },
  { city: 'Miami', state: 'FL', country: 'USA' },
];

const FIRST_NAMES_M = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Christopher'];
const FIRST_NAMES_F = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez'];

function mapCustomer(row: CreditCardCustomer): Omit<Customer, 'id' | 'created_at' | 'updated_at'> {
  // Generate realistic name
  const firstNames = row.Gender === 'M' ? FIRST_NAMES_M : FIRST_NAMES_F;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${row.CLIENTNUM.slice(-4)}@example.com`;

  // Map income
  const incomeRange = INCOME_MAP[row.Income_Category] || INCOME_MAP['Unknown'];
  const income = Math.floor(Math.random() * (incomeRange[1] - incomeRange[0])) + incomeRange[0];

  // Map occupation and employer
  const education = row.Education_Level || 'Unknown';
  const occupations = EDUCATION_OCCUPATIONS[education] || EDUCATION_OCCUPATIONS['Unknown'];
  const employers = EDUCATION_EMPLOYERS[education] || EDUCATION_EMPLOYERS['Unknown'];
  const occupation = occupations[Math.floor(Math.random() * occupations.length)];
  const employer = employers[Math.floor(Math.random() * employers.length)];

  // Calculate net worth based on credit behavior
  const creditUtilization = row.Avg_Utilization_Ratio;
  const accountAge = row.Months_on_book / 12; // Years
  const transactionVolume = row.Total_Trans_Amt;

  // Net worth formula: income * years * savings_rate + accumulated_assets
  const savingsRate = creditUtilization < 0.3 ? 0.15 : creditUtilization < 0.7 ? 0.08 : 0.03;
  const netWorth = Math.max(
    income * accountAge * savingsRate + (transactionVolume * 0.05),
    income * 0.5 // Minimum net worth
  );

  // Risk level based on credit behavior
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  const isChurned = row.Attrition_Flag === 'Attrited Customer';
  const isInactive = row.Months_Inactive_12_mon > 3;
  const highUtilization = creditUtilization > 0.8;
  const lowTransactions = row.Total_Trans_Ct < 30;

  if (isChurned) {
    riskLevel = 'critical';
  } else if (highUtilization && lowTransactions) {
    riskLevel = 'high';
  } else if (isInactive || highUtilization || lowTransactions) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  // KYC status based on account characteristics
  let kycStatus: 'pending' | 'in_progress' | 'verified' | 'rejected' | 'flagged';
  if (isChurned) {
    kycStatus = Math.random() > 0.5 ? 'rejected' : 'flagged';
  } else if (row.Months_on_book < 12) {
    kycStatus = 'in_progress';
  } else if (riskLevel === 'high' || riskLevel === 'critical') {
    kycStatus = 'flagged';
  } else {
    kycStatus = 'verified';
  }

  // Generate location
  const location = CITIES[Math.floor(Math.random() * CITIES.length)];

  // Generate birth date from age
  const birthYear = new Date().getFullYear() - row.Customer_Age;
  const birthMonth = Math.floor(Math.random() * 12) + 1;
  const birthDay = Math.floor(Math.random() * 28) + 1;
  const dateOfBirth = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;

  // Generate tags
  const tags: string[] = [];
  tags.push(row.Card_Category.toLowerCase().replace(' ', '_'));
  tags.push(row.Marital_Status.toLowerCase());
  if (row.Gender === 'M') tags.push('male');
  if (row.Gender === 'F') tags.push('female');
  if (row.Total_Trans_Ct > 80) tags.push('high_activity');
  if (row.Total_Trans_Ct < 30) tags.push('low_activity');
  if (creditUtilization > 0.7) tags.push('high_utilization');
  if (row.Credit_Limit > 10000) tags.push('high_credit_limit');
  if (isChurned) tags.push('churned');
  if (income > 120000) tags.push('high_income');

  return {
    email,
    first_name: firstName,
    last_name: lastName,
    phone: `+1${Math.floor(Math.random() * 900 + 100)}${Math.floor(Math.random() * 900 + 100)}${Math.floor(Math.random() * 9000 + 1000)}`,
    date_of_birth: dateOfBirth,

    address_line1: `${Math.floor(Math.random() * 9000 + 1000)} Main St`,
    address_line2: Math.random() > 0.6 ? `Apt ${Math.floor(Math.random() * 500 + 1)}` : undefined,
    city: location.city,
    state: location.state,
    postal_code: String(Math.floor(Math.random() * 90000 + 10000)),
    country: location.country,

    kyc_status: kycStatus,
    kyc_completed_at: kycStatus === 'verified' ? Date.now() - Math.floor(Math.random() * 365 * 86400000) : undefined,
    kyc_verified_by: kycStatus === 'verified' ? 'system' : undefined,
    risk_level: riskLevel,

    occupation,
    employer,
    annual_income: Math.round(income),
    net_worth: Math.max(0, Math.round(netWorth)),

    profile_embedding: undefined, // Will be generated separately

    source: 'kaggle_import',
    tags: JSON.stringify(tags),
    notes: `Imported from Kaggle. Credit Limit: $${row.Credit_Limit}, Transactions: ${row.Total_Trans_Ct}, Utilization: ${(creditUtilization * 100).toFixed(1)}%`,
  };
}

async function importKaggleData(csvPath: string) {
  console.log('📥 Importing Kaggle Credit Card Customers dataset\n');
  console.log(`   File: ${csvPath}`);

  // Check if file exists
  if (!fs.existsSync(csvPath)) {
    console.error(`\n❌ File not found: ${csvPath}`);
    console.log('\n💡 Download the dataset first:');
    console.log('   1. Install Kaggle CLI: pip install kaggle');
    console.log('   2. Download: kaggle datasets download -d sakshigoyal7/credit-card-customers');
    console.log('   3. Unzip: unzip credit-card-customers.zip -d data/');
    process.exit(1);
  }

  // Read and parse CSV
  console.log('   Reading CSV file...');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    cast: true,
  }) as CreditCardCustomer[];

  console.log(`   ✓ Found ${rows.length} records\n`);

  const db = getDatabase();
  const repository = createRepository(db.getConnection());

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  console.log('📊 Importing customers...\n');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      const customer = mapCustomer(row);

      // Check for duplicate email
      const existing = repository.customers.findByEmail(customer.email);
      if (existing) {
        skipped++;
        continue;
      }

      repository.customers.create(customer);
      imported++;

      if ((imported + skipped) % 500 === 0) {
        console.log(`   Progress: ${imported + skipped}/${rows.length} (${imported} imported, ${skipped} skipped)`);
      }
    } catch (error) {
      console.error('   Error importing customer:', row.CLIENTNUM, '-', error instanceof Error ? error.message : error);
      errors++;
    }
  }

  console.log(`\n✨ Import complete!\n`);
  console.log(`📊 Results:`);
  console.log(`   ✅ Imported: ${imported} customers`);
  console.log(`   ⏭️  Skipped: ${skipped} duplicates`);
  if (errors > 0) {
    console.log(`   ❌ Errors: ${errors} failed`);
  }

  // Statistics
  const allCustomers = repository.customers.list();
  const byRisk = new Map<string, number>();
  const byKYC = new Map<string, number>();
  let totalIncome = 0;

  for (const customer of allCustomers) {
    if (customer.risk_level) {
      byRisk.set(customer.risk_level, (byRisk.get(customer.risk_level) || 0) + 1);
    }
    byKYC.set(customer.kyc_status, (byKYC.get(customer.kyc_status) || 0) + 1);
    totalIncome += customer.annual_income || 0;
  }

  console.log(`\n📈 Dataset Statistics:`);
  console.log(`   Total customers: ${allCustomers.length}`);
  console.log(`   Average income: $${Math.round(totalIncome / allCustomers.length).toLocaleString()}`);
  console.log(`\n   Risk Distribution:`);
  for (const [risk, count] of Array.from(byRisk.entries()).sort()) {
    console.log(`     ${risk}: ${count} (${((count / allCustomers.length) * 100).toFixed(1)}%)`);
  }
  console.log(`\n   KYC Status Distribution:`);
  for (const [status, count] of Array.from(byKYC.entries()).sort()) {
    console.log(`     ${status}: ${count} (${((count / allCustomers.length) * 100).toFixed(1)}%)`);
  }

  console.log(`\n💡 Next steps:`);
  console.log(`   1. Generate embeddings: pnpm generate-embeddings`);
  console.log(`   2. Start dashboard: pnpm dev`);
  console.log(`   3. Run segmentation: Click "Run Segmentation" button`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const csvPath = process.argv[2] || 'data/BankChurners.csv';
  importKaggleData(csvPath)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n❌ Import failed:', error);
      process.exit(1);
    });
}

export { importKaggleData };
