import { describe, it, expect } from '@jest/globals';
import { getSpeechModelMetadata, isValidSpeechModelId, getAllSpeechModels } from '../registry';

describe('Speech Model Registry', () => {
  it('should validate OCI TTS model IDs', () => {
    expect(isValidSpeechModelId('TTS_2_NATURAL')).toBe(true);
    expect(isValidSpeechModelId('TTS_1_STANDARD')).toBe(true);
    expect(isValidSpeechModelId('invalid-model')).toBe(false);
    expect(isValidSpeechModelId('oci.tts-1-hd')).toBe(false);
  });

  it('should return metadata for TTS_2_NATURAL', () => {
    const metadata = getSpeechModelMetadata('TTS_2_NATURAL');

    expect(metadata).toBeDefined();
    expect(metadata?.id).toBe('TTS_2_NATURAL');
    expect(metadata?.name).toBe('OCI TTS Natural');
    expect(metadata?.family).toBe('oci-speech');
    expect(metadata?.modelName).toBe('TTS_2_NATURAL');
    expect(metadata?.supportedFormats).toContain('mp3');
  });

  it('should return metadata for TTS_1_STANDARD', () => {
    const metadata = getSpeechModelMetadata('TTS_1_STANDARD');

    expect(metadata).toBeDefined();
    expect(metadata?.id).toBe('TTS_1_STANDARD');
    expect(metadata?.name).toBe('OCI TTS Standard');
    expect(metadata?.modelName).toBe('TTS_1_STANDARD');
  });

  it('should return undefined for invalid model IDs', () => {
    const metadata = getSpeechModelMetadata('invalid-model');
    expect(metadata).toBeUndefined();
  });

  it('should list all speech models', () => {
    const models = getAllSpeechModels();

    expect(models.length).toBe(2);
    expect(models.every((m) => m.family === 'oci-speech')).toBe(true);
  });

  it('should include supported languages for TTS_2_NATURAL', () => {
    const metadata = getSpeechModelMetadata('TTS_2_NATURAL');

    expect(metadata?.supportedLanguages).toContain('en-US');
    expect(metadata?.supportedLanguages).toContain('ja-JP');
    expect(metadata?.supportedLanguages).toContain('cmn-CN');
    expect(metadata?.supportedLanguages.length).toBe(9);
  });

  it('should include supported languages for TTS_1_STANDARD', () => {
    const metadata = getSpeechModelMetadata('TTS_1_STANDARD');

    expect(metadata?.supportedLanguages).toContain('en-US');
    expect(metadata?.supportedLanguages.length).toBe(1);
  });

  it('should not have requiredRegion constraint', () => {
    const metadata = getSpeechModelMetadata('TTS_2_NATURAL');

    // requiredRegion was removed - TTS is available in multiple regions
    expect(metadata).not.toHaveProperty('requiredRegion');
  });
});
