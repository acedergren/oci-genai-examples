// Global test setup
const originalEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  // Save original values before overwriting
  originalEnv.OCI_REGION = process.env.OCI_REGION;
  originalEnv.OCI_COMPARTMENT_ID = process.env.OCI_COMPARTMENT_ID;

  // Set test environment variables
  process.env.OCI_REGION = 'eu-frankfurt-1';
  process.env.OCI_COMPARTMENT_ID = 'ocid1.compartment.oc1..test';
});

afterAll(() => {
  // Restore original values (or delete if they weren't set)
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});
