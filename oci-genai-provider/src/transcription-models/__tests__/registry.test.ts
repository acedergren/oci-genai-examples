import { describe, it, expect } from '@jest/globals';
import {
  getTranscriptionModelMetadata,
  isValidTranscriptionModelId,
  getAllTranscriptionModels,
  getOracleLanguages,
  getWhisperLanguages,
} from '../registry';

describe('Transcription Model Registry', () => {
  it('should validate transcription model IDs', () => {
    expect(isValidTranscriptionModelId('ORACLE')).toBe(true);
    expect(isValidTranscriptionModelId('WHISPER_MEDIUM')).toBe(true);
    expect(isValidTranscriptionModelId('WHISPER_LARGE_V2')).toBe(true);
    expect(isValidTranscriptionModelId('invalid-model')).toBe(false);
    expect(isValidTranscriptionModelId('oci.speech.standard')).toBe(false);
  });

  it('should return metadata for valid transcription models', () => {
    const metadata = getTranscriptionModelMetadata('ORACLE');

    expect(metadata).toBeDefined();
    expect(metadata?.id).toBe('ORACLE');
    expect(metadata?.name).toBe('OCI Speech Oracle');
    expect(metadata?.family).toBe('oci-speech');
    expect(metadata?.modelType).toBe('ORACLE');
  });

  it('should return metadata for WHISPER_MEDIUM', () => {
    const metadata = getTranscriptionModelMetadata('WHISPER_MEDIUM');

    expect(metadata).toBeDefined();
    expect(metadata?.id).toBe('WHISPER_MEDIUM');
    expect(metadata?.modelType).toBe('WHISPER_MEDIUM');
  });

  it('should return metadata for WHISPER_LARGE_V2', () => {
    const metadata = getTranscriptionModelMetadata('WHISPER_LARGE_V2');

    expect(metadata).toBeDefined();
    expect(metadata?.id).toBe('WHISPER_LARGE_V2');
    expect(metadata?.modelType).toBe('WHISPER_LARGE_V2');
  });

  it('should return undefined for invalid model IDs', () => {
    const metadata = getTranscriptionModelMetadata('invalid-model');
    expect(metadata).toBeUndefined();
  });

  it('should list all transcription models', () => {
    const models = getAllTranscriptionModels();

    expect(models.length).toBe(3);
    expect(models.some((m) => m.id === 'ORACLE')).toBe(true);
    expect(models.some((m) => m.id === 'WHISPER_MEDIUM')).toBe(true);
    expect(models.some((m) => m.id === 'WHISPER_LARGE_V2')).toBe(true);
  });

  it('should return Oracle languages (locale-specific)', () => {
    const languages = getOracleLanguages();

    expect(languages).toContain('en-US');
    expect(languages).toContain('es-ES');
    expect(languages).toContain('de-DE');
    expect(languages.length).toBe(10);
  });

  it('should return Whisper languages (locale-agnostic)', () => {
    const languages = getWhisperLanguages();

    expect(languages).toContain('en');
    expect(languages).toContain('es');
    expect(languages).toContain('de');
    expect(languages.length).toBeGreaterThan(10);
  });

  it('should indicate Whisper supports more languages', () => {
    const oracle = getTranscriptionModelMetadata('ORACLE');
    const whisper = getTranscriptionModelMetadata('WHISPER_MEDIUM');

    expect(oracle).toBeDefined();
    expect(whisper).toBeDefined();
    expect(oracle!.maxLanguages).toBeLessThan(whisper!.maxLanguages);
  });

  it('should indicate Oracle supports custom vocabulary', () => {
    const oracle = getTranscriptionModelMetadata('ORACLE');
    const whisper = getTranscriptionModelMetadata('WHISPER_MEDIUM');

    expect(oracle?.supportsCustomVocabulary).toBe(true);
    expect(whisper?.supportsCustomVocabulary).toBe(false);
  });
});
