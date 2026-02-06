export interface TranscriptionModelMetadata {
  id: string;
  name: string;
  family: 'oci-speech';
  modelType: 'ORACLE' | 'WHISPER_MEDIUM' | 'WHISPER_LARGE_V2';
  maxLanguages: number;
  supportsCustomVocabulary: boolean;
  supportedFormats: string[];
  maxFileSizeMB: number;
}

export const TRANSCRIPTION_MODELS: TranscriptionModelMetadata[] = [
  {
    id: 'ORACLE',
    name: 'OCI Speech Oracle',
    family: 'oci-speech',
    modelType: 'ORACLE',
    maxLanguages: 10,
    supportsCustomVocabulary: true,
    supportedFormats: ['wav', 'mp3', 'flac', 'ogg'],
    maxFileSizeMB: 2048,
  },
  {
    id: 'WHISPER_MEDIUM',
    name: 'OCI Speech Whisper Medium',
    family: 'oci-speech',
    modelType: 'WHISPER_MEDIUM',
    maxLanguages: 50,
    supportsCustomVocabulary: false,
    supportedFormats: ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'webm'],
    maxFileSizeMB: 2048,
  },
  {
    id: 'WHISPER_LARGE_V2',
    name: 'OCI Speech Whisper Large V2',
    family: 'oci-speech',
    modelType: 'WHISPER_LARGE_V2',
    maxLanguages: 50,
    supportsCustomVocabulary: false,
    supportedFormats: ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'webm'],
    maxFileSizeMB: 2048,
  },
];

/**
 * Supported languages for OCI Speech Oracle model (locale-specific)
 */
export const ORACLE_LANGUAGES = [
  'en-US', // English (US)
  'es-ES', // Spanish (Spain)
  'pt-BR', // Portuguese (Brazil)
  'en-GB', // English (UK)
  'en-AU', // English (Australia)
  'en-IN', // English (India)
  'hi-IN', // Hindi
  'fr-FR', // French
  'de-DE', // German
  'it-IT', // Italian
] as const;

/**
 * Supported languages for Whisper models (locale-agnostic)
 * Whisper supports 50+ languages; these are the most common.
 */
export const WHISPER_LANGUAGES = [
  'en', // English
  'es', // Spanish
  'pt', // Portuguese
  'fr', // French
  'de', // German
  'it', // Italian
  'ja', // Japanese
  'ko', // Korean
  'zh', // Chinese
  'nl', // Dutch
  'pl', // Polish
  'ru', // Russian
  'tr', // Turkish
  'hi', // Hindi
  'ar', // Arabic
] as const;

export type OracleLanguage = (typeof ORACLE_LANGUAGES)[number];
export type WhisperLanguage = (typeof WHISPER_LANGUAGES)[number];

export function isValidTranscriptionModelId(modelId: string): boolean {
  return TRANSCRIPTION_MODELS.some((m) => m.id === modelId);
}

export function getTranscriptionModelMetadata(
  modelId: string
): TranscriptionModelMetadata | undefined {
  return TRANSCRIPTION_MODELS.find((m) => m.id === modelId);
}

export function getAllTranscriptionModels(): TranscriptionModelMetadata[] {
  return TRANSCRIPTION_MODELS;
}

export function getOracleLanguages(): readonly string[] {
  return ORACLE_LANGUAGES;
}

export function getWhisperLanguages(): readonly string[] {
  return WHISPER_LANGUAGES;
}

export function getSupportedLanguages(): readonly string[] {
  return [...ORACLE_LANGUAGES, ...WHISPER_LANGUAGES];
}

export type SupportedLanguage = OracleLanguage | WhisperLanguage;
