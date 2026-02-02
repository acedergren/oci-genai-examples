import type { JSONObject } from '@ai-sdk/provider';
import { InvalidArgumentError as AISDKInvalidArgumentError } from '@ai-sdk/provider';
import type { OCIServingMode } from '../types';
import { parseProviderOptions, type OCIProviderOptions } from './schemas';

type ProviderOptions = Record<string, JSONObject> | undefined;

export type ResolvedServingMode =
  | {
      servingType: 'ON_DEMAND';
      modelId: string;
    }
  | {
      servingType: 'DEDICATED';
      endpointId: string;
    };

/**
 * Extracts and validates OCI provider options from the providerOptions object.
 * Uses Zod schema for runtime validation of user-provided options.
 *
 * @throws OCIValidationError if options are invalid
 */
export function getOCIProviderOptions(
  providerOptions?: ProviderOptions
): OCIProviderOptions | undefined {
  if (!providerOptions) {
    return undefined;
  }

  const raw = providerOptions.oci;
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  // Validate with Zod schema - throws OCIValidationError on invalid input
  return parseProviderOptions(raw);
}

// Re-export for convenience
export type { OCIProviderOptions } from './schemas';

export function resolveServingMode(
  modelId: string,
  configMode?: OCIServingMode,
  overrideMode?: OCIServingMode
): ResolvedServingMode {
  const mode = overrideMode ?? configMode;

  if (!mode || mode.type === 'ON_DEMAND') {
    return {
      servingType: 'ON_DEMAND',
      modelId: mode?.modelId ?? modelId,
    };
  }

  if (!mode.endpointId) {
    throw new AISDKInvalidArgumentError({
      argument: 'providerOptions.oci.servingMode.endpointId',
      message: 'Dedicated serving requires an endpointId.',
    });
  }

  return {
    servingType: 'DEDICATED',
    endpointId: mode.endpointId,
  };
}

export function resolveCompartmentId(
  configCompartmentId: string,
  overrideCompartmentId?: string
): string {
  return overrideCompartmentId ?? configCompartmentId;
}

export function resolveEndpoint(
  configEndpoint: string | undefined,
  overrideEndpoint?: string
): string | undefined {
  return overrideEndpoint ?? configEndpoint;
}
