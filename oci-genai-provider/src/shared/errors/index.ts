/**
 * Error types for OCI GenAI Provider.
 * Provides specific error classes for different failure scenarios.
 */

import { APICallError, AISDKError, InvalidResponseDataError } from '@ai-sdk/provider';

export interface OCIGenAIErrorOptions {
  cause?: Error;
}

/**
 * Base error class for all OCI GenAI errors.
 */
export class OCIGenAIError extends Error {
  override readonly name: string = 'OCIGenAIError';
  readonly cause?: Error;
  readonly retryable: boolean;
  readonly statusCode?: number;

  constructor(
    message: string,
    statusCodeOrOptions?: number | OCIGenAIErrorOptions,
    retryable: boolean = false
  ) {
    super(message);

    // Support both old API (statusCode, retryable) and new API (options object)
    if (typeof statusCodeOrOptions === 'number') {
      this.statusCode = statusCodeOrOptions;
      this.retryable = retryable;
    } else {
      this.cause = statusCodeOrOptions?.cause;
      this.retryable = retryable;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export interface NetworkErrorOptions extends OCIGenAIErrorOptions {
  code?: string;
}

/**
 * Error thrown for network-related failures (connection reset, timeout, DNS, etc.).
 * These errors are typically retryable.
 */
export class NetworkError extends OCIGenAIError {
  override readonly name: string = 'NetworkError';
  override readonly retryable = true;
  readonly code?: string;

  constructor(message: string, options?: NetworkErrorOptions) {
    super(message, options, true);
    this.code = options?.code;
  }
}

export interface RateLimitErrorOptions extends OCIGenAIErrorOptions {
  retryAfterMs?: number;
}

/**
 * Error thrown when rate limit (429) is exceeded.
 * These errors are retryable after waiting the specified time.
 */
export class RateLimitError extends OCIGenAIError {
  override readonly name: string = 'RateLimitError';
  override readonly retryable = true;
  readonly retryAfterMs?: number;

  constructor(message: string, options?: RateLimitErrorOptions) {
    super(message, options, true);
    this.retryAfterMs = options?.retryAfterMs;
  }
}

export interface AuthenticationErrorOptions extends OCIGenAIErrorOptions {
  authType?: 'api_key' | 'instance_principal' | 'resource_principal' | 'session_token';
}

/**
 * Error thrown for authentication failures (invalid credentials, expired tokens, etc.).
 * These errors are NOT retryable - credentials need to be fixed.
 */
export class AuthenticationError extends OCIGenAIError {
  override readonly name: string = 'AuthenticationError';
  override readonly retryable = false;
  readonly authType?: string;

  constructor(message: string, options?: AuthenticationErrorOptions) {
    super(message, options, false);
    this.authType = options?.authType;
  }
}

/**
 * Error thrown when a requested model is not found or not available.
 * These errors are NOT retryable - model ID needs to be corrected.
 */
export class ModelNotFoundError extends OCIGenAIError {
  override readonly name: string = 'ModelNotFoundError';
  override readonly retryable = false;
  readonly modelId: string;

  constructor(modelId: string, options?: OCIGenAIErrorOptions) {
    super(
      `Model not found: ${modelId}. Check that the model ID is correct and available in your region.`,
      options,
      false
    );
    this.modelId = modelId;
  }
}

export interface ValidationErrorOptions extends OCIGenAIErrorOptions {
  issues?: unknown[];
}

/**
 * Error thrown when validation of user-provided input fails.
 * These errors are NOT retryable - input needs to be corrected.
 */
export class OCIValidationError extends OCIGenAIError {
  override readonly name: string = 'OCIValidationError';
  override readonly retryable = false;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, undefined, false);
    this.details = details;
  }
}

/**
 * Check if an HTTP status code indicates a retryable error.
 */
export function isRetryableStatusCode(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

/**
 * Handle and wrap OCI errors with additional context.
 */
export function handleOCIError(error: unknown): AISDKError {
  if (AISDKError.isInstance(error)) {
    return error;
  }

  if (error instanceof OCIGenAIError) {
    if (error instanceof OCIValidationError) {
      return new InvalidResponseDataError({
        message: error.message,
        data: error.details,
      });
    }

    return new APICallError({
      message: error.message,
      url: 'oci-genai',
      requestBodyValues: undefined,
      statusCode: error.statusCode,
      responseHeaders: error.statusCode ? { status: String(error.statusCode) } : undefined,
      responseBody: undefined,
      cause: error.cause,
      isRetryable: error.retryable,
    });
  }

  const statusCode =
    (error as { statusCode?: number })?.statusCode ?? (error as { status?: number })?.status;
  const retryable = statusCode ? isRetryableStatusCode(statusCode) : false;
  const responseHeaders = (error as { responseHeaders?: Record<string, string> })?.responseHeaders;
  const opcRequestId = (error as { opcRequestId?: string })?.opcRequestId;
  const responseBody = (error as { responseBody?: string })?.responseBody;
  const url = (error as { url?: string })?.url ?? 'oci-genai';

  let message = error instanceof Error ? error.message : String(error);

  if (statusCode === 401) {
    message += '\nCheck OCI authentication configuration.';
  } else if (statusCode === 403) {
    message += '\nCheck IAM policies and compartment access.';
  } else if (statusCode === 404) {
    message += '\nCheck model ID and regional availability.';
  } else if (statusCode === 429) {
    message += '\nRate limit exceeded. Implement retry with backoff.';
  }

  return new APICallError({
    message,
    url,
    requestBodyValues: undefined,
    statusCode,
    responseHeaders:
      responseHeaders ?? (opcRequestId ? { 'opc-request-id': opcRequestId } : undefined),
    responseBody,
    cause: error,
    isRetryable: retryable,
  });
}
