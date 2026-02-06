import { describe, it, expect } from '@jest/globals';
import type {
  OCIConfig,
  OCILanguageModelSettings,
  OCIEmbeddingSettings,
  OCISpeechSettings,
  OCITranscriptionSettings,
  OCIRerankingSettings,
} from '../types';

describe('OCIConfig', () => {
  it('should allow optional region configuration', () => {
    const config: OCIConfig = {
      region: 'eu-frankfurt-1',
    };
    expect(config.region).toBe('eu-frankfurt-1');
  });

  it('should allow all authentication methods', () => {
    const configWithProfile: OCIConfig = {
      region: 'eu-frankfurt-1',
      profile: 'FRANKFURT',
    };

    const configWithAuth: OCIConfig = {
      region: 'eu-frankfurt-1',
      auth: 'instance_principal',
    };

    expect(configWithProfile.profile).toBe('FRANKFURT');
    expect(configWithAuth.auth).toBe('instance_principal');
  });
});

// ============================================================================
// ProviderV3 Model-Specific Settings Tests
// ============================================================================

describe('OCILanguageModelSettings', () => {
  it('should support all OCIConfig fields plus requestOptions', () => {
    const settings: OCILanguageModelSettings = {
      region: 'eu-stockholm-1',
      requestOptions: {
        timeoutMs: 60000,
        retry: {
          enabled: true,
          maxRetries: 5,
        },
      },
    };

    expect(settings.region).toBe('eu-stockholm-1');
    expect(settings.requestOptions?.timeoutMs).toBe(60000);
  });
});

describe('OCIEmbeddingSettings', () => {
  it('should have embedding-specific options', () => {
    const settings: OCIEmbeddingSettings = {
      region: 'eu-frankfurt-1',
      dimensions: 1024,
      truncate: 'END',
      inputType: 'SEARCH_DOCUMENT',
    };

    expect(settings.dimensions).toBe(1024);
    expect(settings.truncate).toBe('END');
    expect(settings.inputType).toBe('SEARCH_DOCUMENT');
  });

  it('should accept 384 dimensions for light models', () => {
    const settings: OCIEmbeddingSettings = {
      dimensions: 384,
    };
    expect(settings.dimensions).toBe(384);
  });
});

describe('OCISpeechSettings', () => {
  it('should have TTS-specific options', () => {
    const settings: OCISpeechSettings = {
      voice: 'emma',
      speed: 1.5,
      format: 'mp3',
    };

    expect(settings.voice).toBe('emma');
    expect(settings.speed).toBe(1.5);
    expect(settings.format).toBe('mp3');
  });
});

describe('OCITranscriptionSettings', () => {
  it('should have STT-specific options', () => {
    const settings: OCITranscriptionSettings = {
      language: 'en',
      model: 'WHISPER_MEDIUM',
      vocabulary: ['OCI', 'GenAI', 'Vercel'],
    };

    expect(settings.language).toBe('en');
    expect(settings.model).toBe('WHISPER_MEDIUM');
    expect(settings.vocabulary).toContain('OCI');
  });
});

describe('OCIRerankingSettings', () => {
  it('should have reranking-specific options', () => {
    const settings: OCIRerankingSettings = {
      topN: 5,
      returnDocuments: true,
    };

    expect(settings.topN).toBe(5);
    expect(settings.returnDocuments).toBe(true);
  });
});
