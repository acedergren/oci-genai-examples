/**
 * OCI SDK Type Definitions
 *
 * Provides strict TypeScript types for OCI GenAI SDK constructs
 * that are not fully typed in the SDK itself. These types ensure
 * 100% type safety without relying on `as any` casts.
 *
 * Note: We use string literals that match OCI SDK enum values rather than
 * importing the SDK enums directly. This ensures compatibility with test mocks
 * and avoids runtime dependencies on the SDK's enum implementation.
 */

// =============================================================================
// API Format Types
// =============================================================================

/**
 * API format for OCI GenAI chat requests.
 * Determines the message structure and capabilities available.
 */
export type OCIApiFormat = 'GENERIC' | 'COHERE' | 'COHEREV2';

// =============================================================================
// Reasoning Types (Generic API Format)
// =============================================================================

/**
 * Reasoning effort level for Generic API format models.
 * These string values match OCI SDK's GenericChatRequest.ReasoningEffort enum.
 */
export type OCIReasoningEffort = 'NONE' | 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Maps provider-level reasoning effort string to OCI ReasoningEffort.
 * Returns a string that is compatible with the SDK's ReasoningEffort enum.
 */
export function toOCIReasoningEffort(effort: string): OCIReasoningEffort {
  const upper = effort.toUpperCase();
  switch (upper) {
    case 'NONE':
      return 'NONE';
    case 'MINIMAL':
      return 'MINIMAL';
    case 'LOW':
      return 'LOW';
    case 'MEDIUM':
      return 'MEDIUM';
    case 'HIGH':
      return 'HIGH';
    default:
      return 'MEDIUM'; // default fallback
  }
}

// =============================================================================
// Thinking Types (Cohere API Format)
// =============================================================================

/**
 * Thinking/reasoning type for Cohere API format models.
 * These string values match OCI SDK's CohereThinkingV2.Type enum.
 */
export type OCIThinkingType = 'ENABLED' | 'DISABLED';

/**
 * Thinking configuration for Cohere models.
 * Structure matches OCI SDK's CohereThinkingV2 interface.
 */
export interface OCIThinkingConfig {
  type: OCIThinkingType;
  tokenBudget?: number;
}

/**
 * Creates a thinking configuration for Cohere models.
 */
export function createThinkingConfig(enabled: boolean, tokenBudget?: number): OCIThinkingConfig {
  return {
    type: enabled ? 'ENABLED' : 'DISABLED',
    tokenBudget,
  };
}

// =============================================================================
// Token Usage Types
// =============================================================================

/**
 * Detailed breakdown of completion tokens.
 */
export interface OCICompletionTokensDetails {
  /** Tokens used for reasoning/thinking */
  reasoningTokens?: number;
  /** Prediction tokens that were accepted */
  acceptedPredictionTokens?: number;
  /** Prediction tokens that were rejected */
  rejectedPredictionTokens?: number;
}

/**
 * Full usage statistics from OCI response.
 */
export interface OCIUsageStats {
  promptTokens?: number;
  completionTokens?: number;
  completionTokensDetails?: OCICompletionTokensDetails;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for OCIApiFormat.
 */
export function isValidApiFormat(value: unknown): value is OCIApiFormat {
  return value === 'GENERIC' || value === 'COHERE' || value === 'COHEREV2';
}
