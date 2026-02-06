/**
 * Tests for OCI GenAI Provider Settings Zod schemas
 *
 * Following /qa-lead test naming conventions:
 * - ZOD-XXX for Zod schema validation tests
 */
import { describe, it, expect } from '@jest/globals';
import {
  CompartmentIdSchema,
  RegionSchema,
  ServingModeSchema,
  EndpointIdSchema,
  OCIProviderSettingsSchema,
  OcidSchema,
  validateProviderSettings,
  parseProviderSettings,
  ModelIdSchema,
  OCIChatModelIdSchema,
} from '../provider-settings';
import { OCIValidationError } from '../../errors';

describe('CompartmentIdSchema', () => {
  it('ZOD-001: accepts valid compartment OCID', () => {
    const validOcid = 'ocid1.compartment.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect(() => CompartmentIdSchema.parse(validOcid)).not.toThrow();
  });

  it('ZOD-002: rejects invalid compartment OCID format', () => {
    const result = CompartmentIdSchema.safeParse('invalid-ocid');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Invalid compartment ID format');
    }
  });

  it('ZOD-003: rejects empty string', () => {
    const result = CompartmentIdSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});

describe('RegionSchema', () => {
  it('ZOD-004: accepts valid region format', () => {
    const validRegions = ['us-chicago-1', 'eu-frankfurt-1', 'ap-tokyo-1', 'sa-saopaulo-1'];
    for (const region of validRegions) {
      expect(() => RegionSchema.parse(region)).not.toThrow();
    }
  });

  it('ZOD-005: rejects invalid region format', () => {
    const result = RegionSchema.safeParse('invalid-region');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Invalid region format');
    }
  });

  it('ZOD-006: rejects AWS-style region format', () => {
    const result = RegionSchema.safeParse('us-east-1a');
    expect(result.success).toBe(false);
  });
});

describe('ServingModeSchema', () => {
  it('ZOD-007: accepts on-demand mode', () => {
    expect(ServingModeSchema.parse('on-demand')).toBe('on-demand');
  });

  it('ZOD-008: accepts dedicated mode', () => {
    expect(ServingModeSchema.parse('dedicated')).toBe('dedicated');
  });

  it('ZOD-009: rejects invalid mode', () => {
    const result = ServingModeSchema.safeParse('hybrid');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("'on-demand' or 'dedicated'");
    }
  });

  it('ZOD-010: defaults to on-demand when parsing undefined', () => {
    expect(ServingModeSchema.parse(undefined)).toBe('on-demand');
  });
});

describe('EndpointIdSchema', () => {
  it('ZOD-011: accepts valid endpoint OCID', () => {
    const validOcid = 'ocid1.generativeaiendpoint.oc1.us-chicago-1.aaaaaaaaa';
    expect(() => EndpointIdSchema.parse(validOcid)).not.toThrow();
  });

  it('ZOD-012: rejects non-OCID endpoint', () => {
    const result = EndpointIdSchema.safeParse('my-custom-endpoint');
    expect(result.success).toBe(false);
  });
});

describe('OCIProviderSettingsSchema', () => {
  it('ZOD-013: accepts valid on-demand settings', () => {
    const settings = {
      compartmentId: 'ocid1.compartment.oc1..aaaaaaaaa',
      region: 'us-chicago-1',
      servingMode: 'on-demand',
    };
    expect(() => OCIProviderSettingsSchema.parse(settings)).not.toThrow();
  });

  it('ZOD-014: accepts valid dedicated settings with endpointId', () => {
    const settings = {
      compartmentId: 'ocid1.compartment.oc1..aaaaaaaaa',
      region: 'us-chicago-1',
      servingMode: 'dedicated',
      endpointId: 'ocid1.generativeaiendpoint.oc1..aaaaaaaaa',
    };
    expect(() => OCIProviderSettingsSchema.parse(settings)).not.toThrow();
  });

  it('ZOD-015: rejects dedicated mode without endpointId', () => {
    const settings = {
      compartmentId: 'ocid1.compartment.oc1..aaaaaaaaa',
      region: 'us-chicago-1',
      servingMode: 'dedicated',
    };
    const result = OCIProviderSettingsSchema.safeParse(settings);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('endpointId is required');
    }
  });

  it('ZOD-016: accepts empty settings object', () => {
    expect(() => OCIProviderSettingsSchema.parse({})).not.toThrow();
  });

  it('ZOD-017: accepts settings with only configProfile', () => {
    const settings = { configProfile: 'CUSTOM' };
    const result = OCIProviderSettingsSchema.parse(settings);
    expect(result.configProfile).toBe('CUSTOM');
  });
});

describe('validateProviderSettings', () => {
  it('ZOD-018: returns success for valid settings', () => {
    const settings = {
      compartmentId: 'ocid1.compartment.oc1..aaaaaaaaa',
      region: 'us-chicago-1',
    };
    const result = validateProviderSettings(settings);
    expect(result.success).toBe(true);
  });

  it('ZOD-019: returns error for invalid settings', () => {
    const settings = {
      compartmentId: 'invalid',
      region: 'invalid',
    };
    const result = validateProviderSettings(settings);
    expect(result.success).toBe(false);
  });
});

describe('parseProviderSettings', () => {
  it('ZOD-020: throws OCIValidationError for invalid settings', () => {
    expect(() => parseProviderSettings({ region: 'invalid' })).toThrow(OCIValidationError);
  });

  it('ZOD-021: returns parsed settings for valid input', () => {
    const settings = {
      compartmentId: 'ocid1.compartment.oc1..aaaaaaaaa',
    };
    const result = parseProviderSettings(settings);
    expect(result.compartmentId).toBe(settings.compartmentId);
    // servingMode is optional and stays undefined when not provided
    expect(result.servingMode).toBeUndefined();
  });

  it('ZOD-026: includes validation issues in OCIValidationError', () => {
    try {
      parseProviderSettings({ region: 'invalid', compartmentId: 'bad' });
      fail('Expected OCIValidationError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(OCIValidationError);
      const validationError = error as OCIValidationError;
      expect(validationError.details).toBeDefined();
      const issues = validationError.details?.issues as unknown[];
      expect(Array.isArray(issues)).toBe(true);
      expect(issues.length).toBeGreaterThan(0);
    }
  });

  it('ZOD-027: error message includes field path', () => {
    try {
      parseProviderSettings({ region: 'invalid' });
      fail('Expected OCIValidationError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(OCIValidationError);
      expect((error as OCIValidationError).message).toContain('region');
    }
  });
});

describe('OcidSchema', () => {
  it('ZOD-028: accepts valid generic OCID', () => {
    const validOcids = [
      'ocid1.compartment.oc1..aaaaaaaaa',
      'ocid1.generativeaiendpoint.oc1.us-chicago-1.aaaaaa',
      'ocid1.instance.oc1.eu-frankfurt-1.aaaaaa',
    ];
    for (const ocid of validOcids) {
      expect(() => OcidSchema.parse(ocid)).not.toThrow();
    }
  });

  it('ZOD-029: rejects invalid OCID format', () => {
    const result = OcidSchema.safeParse('not-an-ocid');
    expect(result.success).toBe(false);
  });
});

describe('ModelIdSchema', () => {
  it('ZOD-022: accepts non-empty model ID', () => {
    expect(() => ModelIdSchema.parse('cohere.command-r-plus')).not.toThrow();
  });

  it('ZOD-023: rejects empty model ID', () => {
    const result = ModelIdSchema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('cannot be empty');
    }
  });
});

describe('OCIChatModelIdSchema', () => {
  it('ZOD-024: accepts simple model ID object', () => {
    const result = OCIChatModelIdSchema.parse({ modelId: 'cohere.command-r' });
    expect(result.modelId).toBe('cohere.command-r');
    expect(result.isDedicatedEndpoint).toBe(false);
  });

  it('ZOD-025: accepts dedicated endpoint model ID', () => {
    const result = OCIChatModelIdSchema.parse({
      modelId: 'ocid1.generativeaiendpoint.oc1..aaaaaaaaa',
      isDedicatedEndpoint: true,
    });
    expect(result.isDedicatedEndpoint).toBe(true);
  });
});
