# Testing Patterns

**Analysis Date:** 2026-02-03

## Test Framework

**Runner:**
- **Jest** - Primary test runner for backend/library code
  - Version: ^30.2.0 (oci-genai-provider)
  - Config: `jest.config.js` in package root
  - Preset: `ts-jest` for TypeScript support
  - Environment: `node` (for backend code)

- **Vitest** - Alternative test runner for some packages
  - Used in: `chatbot-demo`, `oci-ai-chat`, `oci-genai-query`, `agent-state`
  - Config: `vitest.config.ts`
  - Environment: `jsdom` (for component testing)

- **Bun test** - Native test runner for Bun runtime
  - Used in: `tui-agent` (Bun-based application)
  - Config: Integrated into `package.json`

**Assertion Library:**
- **@jest/globals** - Jest's built-in assertions
  - Methods: `expect()`, `toBe()`, `toContain()`, `toBeTruthy()`, `toReject()`, etc.
  - Supports async testing with promises

**Run Commands:**
```bash
# All tests
pnpm test                      # Run all tests in workspace
npm test                       # In specific package

# Watch mode
npm run test:watch            # Continuous testing

# Coverage
npm run test:coverage         # Generate coverage report
npm run test:coverage:ci      # CI-specific coverage (max 2 workers)

# Specific test types (oci-genai-provider)
npm run test:unit             # Unit tests only (skip integration)
npm run test:integration      # Integration tests only
```

## Test File Organization

**Location:**
- **Co-located pattern:** Test files live in `__tests__` subdirectory at same level as source
  - Pattern: `src/module/__tests__/SourceFile.test.ts` tests `src/module/SourceFile.ts`
  - Examples:
    - `src/config/__tests__/validation.test.ts` tests `src/config/validation.ts`
    - `src/language-models/__tests__/OCILanguageModel.test.ts` tests `src/language-models/OCILanguageModel.ts`

- **Alternative:** Test directory mirrors source structure
  - Used in some packages: `src/tests/chat-api.test.ts` for package-level tests

**Naming:**
- Pattern: `SourceFileName.test.ts` or `SourceFileName.test.tsx`
- Integration tests: `SourceFileName.integration.test.ts`
- Specialized tests: `SourceFileName.advanced.test.ts`, `SourceFileName-retry.test.ts`
- Examples: `validation.test.ts`, `OCILanguageModel.test.ts`, `messages.test.ts`

**Structure:**
```
src/
├── module/
│   ├── SourceFile.ts
│   ├── __tests__/
│   │   ├── SourceFile.test.ts
│   │   ├── SourceFile.integration.test.ts
│   │   └── SourceFile.advanced.test.ts
│   └── __mocks__/
│       └── mock-data.ts
├── __tests__/
│   ├── setup.ts
│   ├── fixtures/
│   │   ├── index.ts
│   │   ├── language-model-responses.ts
│   │   └── embedding-responses.ts
│   ├── mocks/
│   │   ├── oci-mocks.ts
│   │   └── test-helpers.ts
│   └── utils/
│       └── test-helpers.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('FeatureName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default mock implementations
  });

  it('should handle normal case', async () => {
    // Arrange
    mockFunction.mockResolvedValue({ expected: 'data' });

    // Act
    const result = await functionUnderTest();

    // Assert
    expect(result).toEqual({ expected: 'data' });
  });

  it('should handle error case', async () => {
    mockFunction.mockRejectedValue(new Error('Network timeout'));
    const result = await functionUnderTest();
    expect(result.valid).toBe(false);
  });
});
```

**Patterns:**
- **Mocking before imports:** Mock external dependencies before importing code under test
  ```typescript
  // Mock OCI SDK before imports
  const mockGetUser = jest.fn();
  jest.mock('oci-identity', () => ({
    IdentityClient: jest.fn().mockImplementation(() => ({
      getUser: mockGetUser,
    })),
  }));

  // Import after mocks
  import { validateCredentials } from '../validation';
  ```

- **Setup and teardown:**
  - `beforeEach()` - Clears all mocks and resets implementations
  - `afterEach()` - Cleanup (if needed, usually handled by Jest)
  - Global `beforeAll()` / `afterAll()` in `setup.ts` for environment configuration

- **Assertion pattern:** Arrange-Act-Assert (AAA)
  ```typescript
  it('should validate credentials', async () => {
    // Arrange
    mockGetUser.mockResolvedValue({
      user: { name: 'test', email: 'test@example.com' }
    });

    // Act
    const result = await validateCredentials('DEFAULT');

    // Assert
    expect(result.valid).toBe(true);
    expect(result.userName).toBe('test');
  });
  ```

**Test grouping:**
- Group related tests by feature/scenario
- Use nested `describe()` blocks for related test groups
- Each `it()` block tests a single behavior/assertion

## Mocking

**Framework:** Jest's native mocking system

**Patterns:**

1. **Module mocks:** `jest.mock()` at top of file before imports
   ```typescript
   jest.mock('oci-common', () => ({
     ConfigFileAuthenticationDetailsProvider: jest.fn().mockImplementation(() => ({
       getUser: jest.fn(),
     })),
   }));
   ```

2. **Function mocks:** Create mock functions with `jest.fn()`
   ```typescript
   const mockGetUser = jest.fn<(userId: string) => Promise<User>>();
   mockGetUser.mockResolvedValue({ name: 'test', email: 'test@example.com' });
   ```

3. **Mock return values:**
   - `.mockResolvedValue()` - For promises that resolve
   - `.mockRejectedValue()` - For promises that reject
   - `.mockReturnValue()` - For sync functions
   - `.mockImplementation()` - For custom function behavior

4. **Mock reset:** `jest.clearAllMocks()` in `beforeEach()` to reset mock state

5. **Type-safe mocks:** Use generic type in `jest.fn<Type>()`
   ```typescript
   const mockFn = jest.fn<(config: OCIConfig) => Promise<AuthenticationDetailsProvider>>();
   ```

**What to Mock:**
- External API clients (OCI SDK, generative AI services)
- Network calls and HTTP requests
- File system operations
- Authentication providers
- Date/time (if needed)

**What NOT to Mock:**
- Business logic functions you're testing
- Core utility functions (retry logic, timeout logic)
- Data transformation functions
- Error handling code paths
- Interfaces/types (use real instances)

**Example from codebase:**
```typescript
// Mock OCI SDK for testing language model
jest.mock('oci-generativeaiinference', () => ({
  GenerativeAiInferenceClient: jest.fn().mockImplementation((config: unknown) => ({
    chat: mockChat,
    region: undefined,
  })),
}));

// Mock auth module
jest.mock('../../auth/index.js', () => ({
  createAuthProvider: (config: OCIConfig) => mockCreateAuthProvider(config),
  getRegion: (config: OCIConfig) => mockGetRegion(config),
}));
```

## Fixtures and Factories

**Test Data:**
- **Fixtures:** Reusable test data objects defined in `fixtures/` directory
  - Location: `src/__tests__/fixtures/`
  - Pattern: Export constant objects organized by feature
  - Example from `language-model-responses.ts`:
    ```typescript
    export const LANGUAGE_MODEL_FIXTURES = {
      simpleCompletion: {
        chatResult: { chatResponse: { text: '...', finishReason: 'COMPLETE' } }
      },
      streamChunks: [ ... ],
      errorResponse: { statusCode: 429, message: '...' }
    };

    export const LANGUAGE_MODEL_REQUESTS = {
      simple: { chatDetails: { ... } }
    };
    ```

- **Mock factories:** Helper functions that create mock objects
  - Location: `src/__tests__/mocks/`
  - Pattern: Named function `mock[ServiceName](options)`
  - Example from `oci-mocks.ts`:
    ```typescript
    export function mockGenerativeAiInferenceClient(options: {
      chatResponse?: any;
      shouldError?: boolean;
    }): any {
      return {
        region: 'eu-frankfurt-1',
        chat: async () => { ... }
      };
    }
    ```

- **Test helpers:** Utility functions for test setup
  - Location: `src/__tests__/utils/test-helpers.ts`
  - Functions: `createMockStreamChunks()`, `createReadableStream()`, `createMockOCIResponse()`
  - Used across multiple test files

**Location:**
- Fixtures: `src/__tests__/fixtures/index.ts` exports all fixtures
- Mocks: `src/__tests__/mocks/oci-mocks.ts` for OCI SDK mocks
- Helpers: `src/__tests__/utils/test-helpers.ts` for common test utilities

## Coverage

**Requirements:**
- **Threshold:** 80% for all metrics (branches, functions, lines, statements)
- **Configuration:** Defined in `jest.config.js`
  ```javascript
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  }
  ```

- **Exclude from coverage:**
  - `src/**/*.test.ts` - Test files themselves
  - `src/**/__tests__/**` - Test directories
  - `src/**/__mocks__/**` - Mock directories
  - `src/index.ts` - Barrel exports (re-exports)
  - `src/types.ts` - Type-only definitions

**View Coverage:**
```bash
npm run test:coverage          # Generate full coverage report
# View HTML report: open coverage/index.html
npm run test:coverage:ci       # CI coverage (max 2 workers)
```

- **Reporters:** Text, HTML, LCOV, JSON formats available in `coverage/` directory

## Test Types

**Unit Tests:**
- Test individual functions/methods in isolation
- Mock all external dependencies
- Cover normal cases and error cases
- Fast execution (<100ms per test ideally)
- Location: `src/module/__tests__/SourceFile.test.ts`
- Example: Testing `validateCredentials()` with mocked auth provider

**Integration Tests:**
- Test interaction between multiple modules
- Mock external services (OCI SDK) but not internal modules
- Named with `.integration.test.ts` suffix
- Slower execution (can use real network in some cases)
- Run separately with `npm run test:integration`
- Example: `v3-specification-alignment.integration.test.ts` (1021 lines)

**E2E Tests:**
- Test complete workflows end-to-end
- Named with `.test.ts` in workflow test files
- Example: `e2e-workflows.test.ts` (792 lines)
- Can include real API calls to OCI

**Component Tests:**
- Svelte/React components tested with component framework
- Use `@testing-library/svelte` for Svelte testing
- Pattern: `Button.test.ts` tests `Button.svelte`
- Example from `chatbot-demo`:
  ```typescript
  import { render } from '@testing-library/svelte/svelte5';
  import { describe, it, expect } from 'vitest';
  import Button from './Button.svelte';

  describe('Button Component', () => {
    it('renders as a button element', () => {
      const { container } = render(Button);
      const button = container.querySelector('button');
      expect(button).toBeTruthy();
    });
  });
  ```

## Common Patterns

**Async Testing:**
```typescript
// Promise-based
it('should handle async operations', async () => {
  mockFn.mockResolvedValue('success');
  const result = await asyncFunction();
  expect(result).toBe('success');
});

// Error testing
it('should handle errors', async () => {
  mockFn.mockRejectedValue(new Error('Network timeout'));
  const result = await functionThatHandlesErrors();
  expect(result.valid).toBe(false);
  expect(result.error).toContain('timeout');
});
```

**Error Testing:**
```typescript
// Test error response handling
it('should return valid=false for authentication failures', async () => {
  const authError = new Error('NotAuthenticated: Invalid API key');
  mockGetUser.mockRejectedValue(authError);

  const result = await validateCredentials('DEFAULT');

  expect(result.valid).toBe(false);
  expect(result.error).toContain('Authentication failed');
});

// Test specific error conditions
it('should detect timeout errors', async () => {
  const timeoutError = new Error('Request timeout: Connection aborted');
  mockGetUser.mockRejectedValue(timeoutError);

  const result = await validateCredentials('DEFAULT');

  expect(result.error).toContain('timeout');
});
```

**Streaming Tests:**
```typescript
// Mock readable stream for testing streaming responses
it('should handle streaming responses', async () => {
  mockChat.mockImplementation(async () => ({
    body: createReadableStream([
      ...createMockStreamChunks(['Generated response']),
      `data: ${JSON.stringify({
        finishReason: 'STOP',
        usage: { promptTokens: 15, completionTokens: 10 }
      })}\n\n`
    ]),
  }));

  const result = await model.doStream({ messages: [...] });
  // Assert streaming behavior
});
```

**Mock Verification:**
```typescript
// Test that mock was called with correct arguments
it('should call OCI client with correct parameters', async () => {
  await validateCredentials('FRANKFURT');

  expect(mockGenerativeAiInferenceClientConstructor).toHaveBeenCalled();
  expect(mockGetRegion).toHaveBeenCalledWith(mockConfig);
});
```

## Global Test Setup

**Location:** `src/__tests__/setup.ts`

**Contents:**
```typescript
// Set environment variables for tests
beforeAll(() => {
  process.env.OCI_REGION = 'eu-frankfurt-1';
  process.env.OCI_COMPARTMENT_ID = 'ocid1.compartment.oc1..test';
});

afterAll(() => {
  // Cleanup
  delete process.env.OCI_REGION;
  delete process.env.OCI_COMPARTMENT_ID;
});
```

**Jest Configuration:**
- Not explicitly configured as setupFiles in jest.config.js
- Manual setup in test files or auto-loaded if properly named

---

*Testing analysis: 2026-02-03*
