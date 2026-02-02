export interface SpeechModelMetadata {
  id: string;
  name: string;
  family: 'oci-speech';
  modelName: string;
  supportedFormats: ('mp3' | 'ogg' | 'pcm')[];
  maxTextLength: number;
  defaultVoice?: string;
  supportedLanguages: string[];
}

/**
 * TTS_2_NATURAL supported languages (9 languages)
 */
export const TTS_2_NATURAL_LANGUAGES = [
  'en-US',
  'en-GB',
  'es-ES',
  'pt-BR',
  'hi-IN',
  'fr-FR',
  'it-IT',
  'ja-JP',
  'cmn-CN',
] as const;

/**
 * TTS_1_STANDARD supported languages
 */
export const TTS_1_STANDARD_LANGUAGES = ['en-US'] as const;

export const SPEECH_MODELS: SpeechModelMetadata[] = [
  {
    id: 'TTS_2_NATURAL',
    name: 'OCI TTS Natural',
    family: 'oci-speech',
    modelName: 'TTS_2_NATURAL',
    supportedFormats: ['mp3', 'ogg', 'pcm'],
    maxTextLength: 5000,
    supportedLanguages: [...TTS_2_NATURAL_LANGUAGES],
  },
  {
    id: 'TTS_1_STANDARD',
    name: 'OCI TTS Standard',
    family: 'oci-speech',
    modelName: 'TTS_1_STANDARD',
    supportedFormats: ['mp3', 'ogg', 'pcm'],
    maxTextLength: 5000,
    supportedLanguages: [...TTS_1_STANDARD_LANGUAGES],
  },
];

export function isValidSpeechModelId(modelId: string): boolean {
  return SPEECH_MODELS.some((m) => m.id === modelId);
}

export function getSpeechModelMetadata(modelId: string): SpeechModelMetadata | undefined {
  return SPEECH_MODELS.find((m) => m.id === modelId);
}

export function getAllSpeechModels(): SpeechModelMetadata[] {
  return SPEECH_MODELS;
}

/**
 * Voice metadata for TTS models
 */
export interface VoiceMetadata {
  id: string;
  name: string;
  language: string;
  model: 'TTS_2_NATURAL' | 'TTS_1_STANDARD';
}

/**
 * Available voices for TTS models
 */
const AVAILABLE_VOICES: VoiceMetadata[] = [
  // TTS_2_NATURAL voices
  { id: 'en-US-AriaNeural', name: 'Aria (US English)', language: 'en-US', model: 'TTS_2_NATURAL' },
  { id: 'en-US-GuyNeural', name: 'Guy (US English)', language: 'en-US', model: 'TTS_2_NATURAL' },
  {
    id: 'en-GB-LibbyNeural',
    name: 'Libby (UK English)',
    language: 'en-GB',
    model: 'TTS_2_NATURAL',
  },
  { id: 'en-GB-RyanNeural', name: 'Ryan (UK English)', language: 'en-GB', model: 'TTS_2_NATURAL' },
  { id: 'es-ES-AlvaroNeural', name: 'Alvaro (Spanish)', language: 'es-ES', model: 'TTS_2_NATURAL' },
  {
    id: 'pt-BR-FranciscaNeural',
    name: 'Francisca (Portuguese BR)',
    language: 'pt-BR',
    model: 'TTS_2_NATURAL',
  },
  { id: 'fr-FR-DeniseNeural', name: 'Denise (French)', language: 'fr-FR', model: 'TTS_2_NATURAL' },
  {
    id: 'it-IT-IsabellaNeural',
    name: 'Isabella (Italian)',
    language: 'it-IT',
    model: 'TTS_2_NATURAL',
  },
  {
    id: 'ja-JP-NanamiNeural',
    name: 'Nanami (Japanese)',
    language: 'ja-JP',
    model: 'TTS_2_NATURAL',
  },
  {
    id: 'cmn-CN-XiaoxuanNeural',
    name: 'Xiaoxuan (Mandarin)',
    language: 'cmn-CN',
    model: 'TTS_2_NATURAL',
  },
  { id: 'hi-IN-AshaNeural', name: 'Asha (Hindi)', language: 'hi-IN', model: 'TTS_2_NATURAL' },
  { id: 'hi-IN-PriyaNeural', name: 'Priya (Hindi)', language: 'hi-IN', model: 'TTS_2_NATURAL' },
  { id: 'hi-IN-ArjunNeural', name: 'Arjun (Hindi)', language: 'hi-IN', model: 'TTS_2_NATURAL' },
  { id: 'hi-IN-RahulNeural', name: 'Rahul (Hindi)', language: 'hi-IN', model: 'TTS_2_NATURAL' },
  // TTS_1_STANDARD voices
  {
    id: 'en-US-Standard-A',
    name: 'Standard A (US English)',
    language: 'en-US',
    model: 'TTS_1_STANDARD',
  },
];

export function getAllVoices(): VoiceMetadata[] {
  return AVAILABLE_VOICES;
}
