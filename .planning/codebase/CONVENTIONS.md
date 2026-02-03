# Coding Conventions

**Analysis Date:** 2026-02-03

## Naming Patterns

**Files:**
- **Classes/Components:** PascalCase for class names and component files
  - Examples: `OCILanguageModel.ts`, `OCISpeechModel.ts`, `OCIRerankingModel.ts`, `Button.svelte`, `ChatInput.test.ts`
  - Models following pattern: `OCI[FeatureName].ts`

- **Utilities/Helpers:** camelCase for utility modules
  - Examples: `validation.ts`, `fallback.ts`, `registry.ts`, `messages.ts`, `tools.ts`

- **Tests:** Match source file name with `.test.ts` or `.test.tsx` suffix
  - Pattern: `SourceFile.test.ts` or `SourceFile.test.tsx`
  - Integration tests: `SourceFile.integration.test.ts`
  - Examples: `validation.test.ts`, `OCILanguageModel.test.ts`, `messages.test.ts`

**Functions:**
- camelCase for all functions and methods
  - Examples: `validateCredentials()`, `convertToOCIMessages()`, `isValidModelId()`, `withRetry()`
  - Private methods: use `_` prefix, e.g., `_getClient()`, `_initializeProvider()`

- Async functions and promises return `Promise<T>`
  - Example: `async function validateCredentials(): Promise<ValidationResult>`

**Variables:**
- **Constants:** UPPERCASE_WITH_UNDERSCORES (exported)
  - Examples: `LANGUAGE_MODEL_FIXTURES`, `AVAILABLE_MODELS`

- **Local variables/parameters:** camelCase
  - Examples: `mockConfig`, `timeoutMs`, `profileName`, `mockAuthProvider`

- **Boolean variables:** prefix with `is`, `has`, `can`, `should`
  - Examples: `isValidModelId()`, `isRetryableError()`, `hasContent`, `shouldError`

**Types/Interfaces:**
- PascalCase for all types and interfaces
  - Examples: `OCIConfig`, `ValidationResult`, `RequestOptions`, `LanguageModelV3`
  - Error types: `OCIGenAIError`, `NetworkError`, `RateLimitError`, `AuthenticationError`

- Suffix pattern for options/request types: `Options`, `Request`, `Response`, `Result`
  - Examples: `OCIGenAIErrorOptions`, `ValidationResult`, `ChatRequest`, `RateLimitErrorOptions`

**Directories:**
- kebab-case for directory names
  - Examples: `language-models`, `shared`, `speech-models`, `reranking-models`, `__tests__`

- Test directories: `__tests__` directory at same level as source
  - Pattern: `src/module/__tests__/` contains tests for `src/module/`

## Code Style

**Formatting:**
- TypeScript strict mode enabled in all `tsconfig.json` files
  - `"strict": true` with all sub-options enabled
  - Options include: `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`

- Target: ES2020 (Node 18+)
  - `"target": "ES2020"` in tsconfig
  - Module system: CommonJS for libraries, ES modules for applications

**Linting:**
- No ESLint config file found; relies on TypeScript strict mode for code quality
- Eslint available as dev dependency in main packages (e.g., oci-genai-provider)
- Code follows explicit type annotations and error handling patterns

**Import Organization:**
- **Order:**
  1. Type imports from external packages (`import type { ... } from '@package'`)
  2. Value imports from external packages (`import { ... } from 'package'`)
  3. Type imports from local paths (`import type { ... } from '../path'`)
  4. Value imports from local paths (`import { ... } from '../path'`)
  5. Barrel exports to group related imports (`import { func1, func2 } from './index.js'`)

- **Examples from codebase:**
  ```typescript
  // Type imports first
  import type {
    LanguageModelV3,
    LanguageModelV3CallOptions,
  } from '@ai-sdk/provider';

  // Then value imports from external
  import { NoSuchModelError } from '@ai-sdk/provider';
  import { GenerativeAiInferenceClient } from 'oci-generativeaiinference';

  // Then local imports
  import type { OCIConfig, RequestOptions } from '../types';
  import { isValidModelId } from './registry';
  import { convertToOCIMessages } from './converters/messages';
  ```

**Path Aliases:**
- Relative imports with explicit extensions (`.js`) for barrel exports
  - Examples: `import { ... } from '../auth/index.js'`, `import { ... } from './index.js'`
  - Required for ESM compatibility

## Error Handling

**Patterns:**
- **Custom error classes:** Extend base error type and maintain type safety
  - Base class: `OCIGenAIError` with retryable flag
  - Subclasses: `NetworkError`, `RateLimitError`, `AuthenticationError`, `ModelNotFoundError`, `OCIValidationError`
  - Location: `src/shared/errors/index.ts`

- **Error detection:** Pattern-match on error message for specific handling
  - Example from `validation.ts`:
  ```typescript
  if (message.includes('NotAuthenticated')) {
    return { valid: false, error: 'Authentication failed...' };
  }
  if (message.includes('timeout') || message.includes('abort')) {
    return { valid: false, error: 'Connection timeout...' };
  }
  ```

- **Error wrapping:** `handleOCIError()` converts all errors to `AISDKError`
  - Detects status codes and determines retryability
  - Adds contextual messages for common error codes (401, 403, 404, 429)

- **Try-catch with resource cleanup:**
  ```typescript
  try {
    // Set timeout
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Main operation
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Handle errors
  }
  ```

- **Type narrowing:** Always check error type before accessing properties
  ```typescript
  const message = error instanceof Error ? error.message : 'Unknown error';
  ```

## Logging

**Framework:** Console API and structured logging

**Patterns:**
- No centralized logging framework; uses console methods directly in some cases
- Errors logged with descriptive context
- Integration tests and setup files may log diagnostic information
- Log output during test runs configurable via environment variables

**When to log:**
- Error conditions with context
- Important state transitions in agent/service code
- Diagnostic information in test setup

## Comments

**When to Comment:**
- JSDoc/TSDoc comments required for all exported functions and public methods
- No inline comments for obvious code
- Complex logic or non-obvious behavior gets explanatory comments
- Example from `validation.ts`:
  ```typescript
  // Provide helpful error messages based on error type
  if (message.includes('NotAuthenticated')) {
    return { ... };
  }
  ```

**JSDoc/TSDoc:**
- All exported functions use JSDoc format with `@param`, `@returns`, `@example` tags
- Type information included in comments
- Example from `validation.ts`:
  ```typescript
  /**
   * Validate OCI credentials by making a test API call
   *
   * @param profileName - Profile name from ~/.oci/config (default: 'DEFAULT')
   * @param timeoutMs - Timeout in milliseconds (default: 10000)
   * @returns Validation result with user info if successful
   *
   * @example
   * ```typescript
   * const result = await validateCredentials('FRANKFURT');
   * ```
   */
  export async function validateCredentials(
    profileName = 'DEFAULT',
    timeoutMs = 10000
  ): Promise<ValidationResult>
  ```

- Error types include JSDoc explaining retryability
  ```typescript
  /**
   * Error thrown for network-related failures (connection reset, timeout, DNS, etc.).
   * These errors are typically retryable.
   */
  export class NetworkError extends OCIGenAIError
  ```

## Function Design

**Size:** Functions remain focused on single responsibility
- Examples: `validateCredentials()` handles only validation with error parsing
- Converters (`convertToOCIMessages()`) handle specific transformation only
- Utility functions (`withRetry()`, `withTimeout()`) handle single cross-cutting concern

**Parameters:**
- Use options objects for functions with multiple parameters (especially >3)
- Example: `function mockGenerativeAiInferenceClient(options: { chatResponse?, embedResponse?, shouldError?, errorType? })`
- Default parameters used for common optional values
  - Examples: `profileName = 'DEFAULT'`, `timeoutMs = 10000`

**Return Values:**
- Explicit return types always specified
- Promise-returning functions return `Promise<T>`
- Union types for error scenarios (rather than throwing in some cases)
  - Example: `ValidationResult` union type with `{ valid: true, ... } | { valid: false, error: string }`
- Void functions for side-effect-only operations (rare)

**Async/Await:**
- Preferred over promise chains
- Try-finally patterns for resource cleanup
- Explicit error handling in try-catch blocks

## Module Design

**Exports:**
- Explicit exports of public functions/classes
- Use barrel exports (`index.ts` files) to group related functionality
- Examples:
  - `src/config/index.ts`: exports config utilities
  - `src/auth/index.ts`: exports auth functions
  - `src/shared/errors/index.ts`: exports error types
  - `src/shared/utils/index.ts`: exports utility functions

- Public API re-exported from main `src/index.ts`
  - Only stable, documented interfaces exported

**Barrel Files:**
- Pattern: Each logical module has `index.ts` barrel file
- Barrel files import and re-export from internal modules
- Reduces import paths for consumers
- Example from `tui-agent`:
  ```typescript
  import { ThemeProvider } from './theme/index.js';
  import { AppShell, Header, StatusBar } from './components/layout/index.js';
  ```

**Internal Structure:**
- `__tests__` folders contain test files only
- `types.ts` or dedicated type files for interfaces
- Converters/utilities in named subdirectories
- Shared utilities in `shared/` directory accessible across modules

---

*Convention analysis: 2026-02-03*
