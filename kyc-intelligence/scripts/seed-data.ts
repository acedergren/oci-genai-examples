// scripts/seed-data.ts
import { getDatabase, createRepository } from '@acedergren/kyc-platform';
import type { Customer } from '@acedergren/kyc-platform';

/**
 * Realistic customer data generator
 * Creates diverse customer profiles across different segments
 */

// Sample data pools
const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Daniel', 'Nancy', 'Matthew', 'Lisa',
  'Anthony', 'Betty', 'Mark', 'Margaret', 'Donald', 'Sandra', 'Steven', 'Ashley',
  'Paul', 'Emily', 'Andrew', 'Kimberly', 'Joshua', 'Donna', 'Kenneth', 'Michelle',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
];

const OCCUPATIONS = [
  // Tech (High income)
  { title: 'Software Engineer', income: [80000, 150000], segment: 'tech' },
  { title: 'Data Scientist', income: [90000, 160000], segment: 'tech' },
  { title: 'Product Manager', income: [100000, 180000], segment: 'tech' },
  { title: 'DevOps Engineer', income: [85000, 145000], segment: 'tech' },

  // Business (Upper-middle income)
  { title: 'Marketing Manager', income: [70000, 120000], segment: 'business' },
  { title: 'Sales Director', income: [80000, 140000], segment: 'business' },
  { title: 'Financial Analyst', income: [65000, 110000], segment: 'business' },
  { title: 'Account Executive', income: [60000, 100000], segment: 'business' },

  // Healthcare (Middle-upper income)
  { title: 'Registered Nurse', income: [60000, 90000], segment: 'healthcare' },
  { title: 'Physician', income: [150000, 300000], segment: 'healthcare' },
  { title: 'Physical Therapist', income: [70000, 95000], segment: 'healthcare' },
  { title: 'Medical Assistant', income: [35000, 50000], segment: 'healthcare' },

  // Education (Middle income)
  { title: 'Teacher', income: [45000, 70000], segment: 'education' },
  { title: 'Professor', income: [70000, 120000], segment: 'education' },
  { title: 'School Administrator', income: [60000, 90000], segment: 'education' },

  // Service (Lower-middle income)
  { title: 'Retail Manager', income: [40000, 60000], segment: 'service' },
  { title: 'Restaurant Server', income: [25000, 40000], segment: 'service' },
  { title: 'Customer Service Rep', income: [35000, 50000], segment: 'service' },

  // Trades (Middle income)
  { title: 'Electrician', income: [50000, 80000], segment: 'trades' },
  { title: 'Plumber', income: [45000, 75000], segment: 'trades' },
  { title: 'Carpenter', income: [40000, 70000], segment: 'trades' },

  // Students (Low income)
  { title: 'Graduate Student', income: [15000, 30000], segment: 'student' },
  { title: 'Undergraduate Student', income: [0, 20000], segment: 'student' },
];

const EMPLOYERS = [
  'Microsoft', 'Google', 'Amazon', 'Apple', 'Meta',
  'Goldman Sachs', 'JP Morgan', 'Bank of America', 'Wells Fargo',
  'Kaiser Permanente', 'Mayo Clinic', 'Cleveland Clinic',
  'Stanford University', 'MIT', 'Harvard', 'UC Berkeley',
  'Target', 'Walmart', 'Costco', 'Starbucks',
  'Self-Employed', 'Freelance', 'Startup', 'Local Business',
];

const CITIES = [
  { city: 'San Francisco', state: 'CA', country: 'USA', segment: 'tech' },
  { city: 'Seattle', state: 'WA', country: 'USA', segment: 'tech' },
  { city: 'Austin', state: 'TX', country: 'USA', segment: 'tech' },
  { city: 'New York', state: 'NY', country: 'USA', segment: 'business' },
  { city: 'Boston', state: 'MA', country: 'USA', segment: 'business' },
  { city: 'Chicago', state: 'IL', country: 'USA', segment: 'business' },
  { city: 'Los Angeles', state: 'CA', country: 'USA', segment: 'diverse' },
  { city: 'Denver', state: 'CO', country: 'USA', segment: 'diverse' },
  { city: 'Portland', state: 'OR', country: 'USA', segment: 'diverse' },
  { city: 'Miami', state: 'FL', country: 'USA', segment: 'diverse' },
  { city: 'Phoenix', state: 'AZ', country: 'USA', segment: 'diverse' },
  { city: 'Dallas', state: 'TX', country: 'USA', segment: 'diverse' },
];

/**
 * Generate a random customer profile
 */
function generateCustomer(): Omit<Customer, 'id' | 'created_at' | 'updated_at'> {
  const firstName = random(FIRST_NAMES);
  const lastName = random(LAST_NAMES);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;

  const occupation = random(OCCUPATIONS);
  const location = random(CITIES);
  const employer = random(EMPLOYERS);

  // Generate income within occupation range
  const income = randomInRange(occupation.income[0], occupation.income[1]);

  // Generate net worth (typically 2-5x annual income, with variance)
  const netWorthMultiplier = randomInRange(2, 8);
  const netWorth = income * netWorthMultiplier + randomInRange(-50000, 100000);

  // Generate age (22-65)
  const age = randomInRange(22, 65);
  const birthYear = new Date().getFullYear() - age;
  const birthMonth = randomInRange(1, 12);
  const birthDay = randomInRange(1, 28);
  const dateOfBirth = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;

  // Risk level based on income stability and occupation
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (income > 100000 && netWorth > 200000) {
    riskLevel = Math.random() > 0.9 ? 'medium' : 'low';
  } else if (income > 60000) {
    riskLevel = Math.random() > 0.7 ? 'medium' : 'low';
  } else if (income > 35000) {
    riskLevel = Math.random() > 0.5 ? 'medium' : 'low';
  } else {
    riskLevel = Math.random() > 0.3 ? 'high' : 'medium';
  }

  // KYC status distribution
  const kycStatuses: Array<'pending' | 'in_progress' | 'verified' | 'rejected' | 'flagged'> =
    ['pending', 'in_progress', 'verified', 'verified', 'verified', 'verified', 'flagged', 'rejected'];
  const kycStatus = random(kycStatuses);

  // Tags based on segment
  const tags: string[] = [];
  if (income > 150000) tags.push('high-value');
  if (netWorth > 500000) tags.push('wealth-management');
  if (age < 30) tags.push('millennial');
  else if (age < 45) tags.push('gen-x');
  else tags.push('boomer');
  if (occupation.segment === 'tech') tags.push('tech-savvy');
  if (occupation.segment === 'student') tags.push('student');

  return {
    email,
    first_name: firstName,
    last_name: lastName,
    phone: generatePhone(),
    date_of_birth: dateOfBirth,

    address_line1: `${randomInRange(100, 9999)} ${random(['Main', 'Oak', 'Maple', 'Cedar', 'Pine'])} ${random(['St', 'Ave', 'Blvd', 'Dr'])}`,
    address_line2: Math.random() > 0.7 ? `Apt ${randomInRange(1, 500)}` : undefined,
    city: location.city,
    state: location.state,
    postal_code: String(randomInRange(10000, 99999)),
    country: location.country,

    kyc_status: kycStatus,
    kyc_completed_at: kycStatus === 'verified' ? Date.now() - randomInRange(1, 365) * 86400000 : undefined,
    kyc_verified_by: kycStatus === 'verified' ? 'system' : undefined,
    risk_level: riskLevel,

    occupation: occupation.title,
    employer,
    annual_income: Math.round(income),
    net_worth: Math.max(0, Math.round(netWorth)),

    profile_embedding: undefined, // Will be generated separately

    source: random(['direct', 'referral', 'marketing', 'partner']),
    tags: JSON.stringify(tags),
    notes: undefined,
  };
}

/**
 * Helper functions
 */
function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone(): string {
  return `+1${randomInRange(200, 999)}${randomInRange(200, 999)}${randomInRange(1000, 9999)}`;
}

/**
 * Main seed function
 */
async function seed(count: number = 200) {
  console.log(`🌱 Seeding ${count} customers...`);

  const db = getDatabase();
  const repository = createRepository(db.getConnection());

  // Generate customers
  const customers: Customer[] = [];
  for (let i = 0; i < count; i++) {
    const customer = repository.customers.create(generateCustomer());
    customers.push(customer);

    if ((i + 1) % 50 === 0) {
      console.log(`   Generated ${i + 1}/${count} customers`);
    }
  }

  console.log(`✅ Created ${customers.length} customers`);

  // Statistics
  const byOccupation = new Map<string, number>();
  const byLocation = new Map<string, number>();
  let totalIncome = 0;
  let totalNetWorth = 0;

  for (const customer of customers) {
    if (customer.occupation) {
      byOccupation.set(customer.occupation, (byOccupation.get(customer.occupation) || 0) + 1);
    }
    if (customer.city) {
      byLocation.set(customer.city, (byLocation.get(customer.city) || 0) + 1);
    }
    totalIncome += customer.annual_income || 0;
    totalNetWorth += customer.net_worth || 0;
  }

  console.log('\n📊 Statistics:');
  console.log(`   Average Income: $${Math.round(totalIncome / customers.length).toLocaleString()}`);
  console.log(`   Average Net Worth: $${Math.round(totalNetWorth / customers.length).toLocaleString()}`);
  console.log(`   Top Occupations: ${Array.from(byOccupation.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([occ, count]) => `${occ} (${count})`).join(', ')}`);
  console.log(`   Top Locations: ${Array.from(byLocation.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([loc, count]) => `${loc} (${count})`).join(', ')}`);

  console.log('\n💡 Next steps:');
  console.log('   1. Generate embeddings: pnpm generate-embeddings');
  console.log('   2. Run segmentation: Use the dashboard at http://localhost:5173');
  console.log('   3. Or use the API: POST /api/intelligence/segment');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const count = parseInt(process.argv[2]) || 200;
  seed(count)
    .then(() => {
      console.log('\n✨ Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export { seed };
