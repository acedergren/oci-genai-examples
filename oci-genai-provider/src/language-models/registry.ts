import type { ModelMetadata } from '../types';

// OCI GenAI regions
export type OCIGenAIRegion =
  | 'us-chicago-1'
  | 'eu-frankfurt-1'
  | 'ap-osaka-1'
  | 'uk-london-1'
  | 'us-ashburn-1'
  | 'ap-mumbai-1'
  | 'us-sanjose-1'
  | 'ap-singapore-1'
  | 'ap-seoul-1'
  | 'sa-saopaulo-1'
  | 'ap-sydney-1'
  | 'ap-tokyo-1'
  | 'ca-toronto-1';

// Regions where each model family is available (based on OCI docs Jan 2026)
const GROK_REGIONS: OCIGenAIRegion[] = ['us-chicago-1', 'us-ashburn-1'];
const GEMINI_REGIONS: OCIGenAIRegion[] = ['us-chicago-1', 'eu-frankfurt-1', 'us-ashburn-1'];
const COHERE_REGIONS: OCIGenAIRegion[] = [
  'us-chicago-1',
  'eu-frankfurt-1',
  'ap-osaka-1',
  'uk-london-1',
  'us-ashburn-1',
  'ap-mumbai-1',
  'us-sanjose-1',
  'ap-singapore-1',
  'ap-seoul-1',
  'sa-saopaulo-1',
  'ap-sydney-1',
  'ap-tokyo-1',
  'ca-toronto-1',
];
const LLAMA_REGIONS: OCIGenAIRegion[] = [
  'us-chicago-1',
  'eu-frankfurt-1',
  'ap-osaka-1',
  'uk-london-1',
  'us-ashburn-1',
  'ap-mumbai-1',
  'us-sanjose-1',
  'ap-singapore-1',
  'ap-seoul-1',
  'sa-saopaulo-1',
  'ap-sydney-1',
  'ap-tokyo-1',
  'ca-toronto-1',
];
const OPENAI_REGIONS: OCIGenAIRegion[] = ['us-chicago-1', 'eu-frankfurt-1', 'us-ashburn-1'];

// Extended metadata with region support
interface ExtendedModelMetadata extends ModelMetadata {
  regions: OCIGenAIRegion[];
  dedicatedOnly?: boolean;
  /** Recommended for coding agents (default enabled in setup) */
  codingRecommended?: boolean;
  /** Why this model is good/bad for coding */
  codingNote?: string;
  /** Override capabilities to include reasoning */
  capabilities: ModelMetadata['capabilities'] & {
    reasoning?: boolean;
  };
}

export const MODEL_CATALOG: ExtendedModelMetadata[] = [
  // ==========================================================================
  // xAI Grok models (US regions only)
  // ==========================================================================
  {
    id: 'xai.grok-code-fast-1',
    name: 'Grok Code Fast 1',
    family: 'grok',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 131072,
    speed: 'very-fast',
    regions: GROK_REGIONS,
    codingRecommended: true,
    codingNote: 'Purpose-built for code generation and understanding',
  },
  {
    id: 'xai.grok-4-1-fast-reasoning',
    name: 'Grok 4.1 Fast Reasoning',
    family: 'grok',
    capabilities: { streaming: true, tools: true, vision: false, reasoning: true },
    contextWindow: 2000000,
    speed: 'very-fast',
    regions: GROK_REGIONS,
    codingRecommended: true,
    codingNote: '2M context window - ideal for large codebases',
  },
  {
    id: 'xai.grok-4-1-fast-non-reasoning',
    name: 'Grok 4.1 Fast (Non-Reasoning)',
    family: 'grok',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 2000000,
    speed: 'very-fast',
    regions: GROK_REGIONS,
  },
  {
    id: 'xai.grok-4-fast-reasoning',
    name: 'Grok 4 Fast Reasoning',
    family: 'grok',
    capabilities: { streaming: true, tools: true, vision: false, reasoning: true },
    contextWindow: 131072,
    speed: 'very-fast',
    regions: GROK_REGIONS,
  },
  {
    id: 'xai.grok-4-fast-non-reasoning',
    name: 'Grok 4 Fast (Non-Reasoning)',
    family: 'grok',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 131072,
    speed: 'very-fast',
    regions: GROK_REGIONS,
  },
  {
    id: 'xai.grok-4',
    name: 'Grok 4',
    family: 'grok',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 131072,
    speed: 'fast',
    regions: GROK_REGIONS,
  },
  {
    id: 'xai.grok-3',
    name: 'Grok 3',
    family: 'grok',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 131072,
    speed: 'fast',
    regions: GROK_REGIONS,
  },
  {
    id: 'xai.grok-3-fast',
    name: 'Grok 3 Fast',
    family: 'grok',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 131072,
    speed: 'very-fast',
    regions: GROK_REGIONS,
  },
  {
    id: 'xai.grok-3-mini',
    name: 'Grok 3 Mini',
    family: 'grok',
    capabilities: { streaming: true, tools: false, vision: false },
    contextWindow: 131072,
    speed: 'very-fast',
    regions: GROK_REGIONS,
    codingNote: 'No tool support - not recommended for coding agents',
  },
  {
    id: 'xai.grok-3-mini-fast',
    name: 'Grok 3 Mini Fast',
    family: 'grok',
    capabilities: { streaming: true, tools: false, vision: false },
    contextWindow: 131072,
    speed: 'very-fast',
    regions: GROK_REGIONS,
    codingNote: 'No tool support - not recommended for coding agents',
  },

  // ==========================================================================
  // Meta Llama models
  // ==========================================================================
  {
    id: 'meta.llama-4-maverick-17b-128e-instruct-fp8',
    name: 'Llama 4 Maverick',
    family: 'llama',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 131072,
    speed: 'very-fast',
    regions: ['us-chicago-1', 'us-ashburn-1'],
    codingRecommended: true,
    codingNote: 'Latest Llama with excellent code capabilities',
  },
  {
    id: 'meta.llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout',
    family: 'llama',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 131072,
    speed: 'very-fast',
    regions: ['us-chicago-1', 'us-ashburn-1'],
  },
  {
    id: 'meta.llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    family: 'llama',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 131072,
    speed: 'fast',
    regions: LLAMA_REGIONS,
    codingRecommended: true,
    codingNote: 'Best general-purpose coding model, widely available',
  },
  {
    id: 'meta.llama-3.2-90b-vision-instruct',
    name: 'Llama 3.2 Vision 90B',
    family: 'llama',
    capabilities: { streaming: true, tools: true, vision: true },
    contextWindow: 131072,
    speed: 'medium',
    regions: ['us-chicago-1', 'us-ashburn-1'],
    codingNote: 'Vision support for analyzing screenshots/diagrams',
  },
  {
    id: 'meta.llama-3.2-11b-vision-instruct',
    name: 'Llama 3.2 Vision 11B',
    family: 'llama',
    capabilities: { streaming: true, tools: true, vision: true },
    contextWindow: 131072,
    speed: 'fast',
    regions: ['us-chicago-1', 'us-ashburn-1'],
    codingNote: 'Lightweight vision model for screenshots',
  },
  {
    id: 'meta.llama-3.1-405b-instruct',
    name: 'Llama 3.1 405B Instruct',
    family: 'llama',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 131072,
    speed: 'slow',
    regions: LLAMA_REGIONS,
    dedicatedOnly: true,
    codingNote: 'Dedicated clusters only - expensive but powerful',
  },
  {
    id: 'meta.llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B Instruct',
    family: 'llama',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 131072,
    speed: 'fast',
    regions: LLAMA_REGIONS,
  },

  // ==========================================================================
  // Google Gemini models
  // ==========================================================================
  {
    id: 'google.gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    family: 'gemini',
    capabilities: { streaming: true, tools: true, vision: true, reasoning: true },
    contextWindow: 1048576,
    speed: 'fast',
    regions: GEMINI_REGIONS,
    codingRecommended: true,
    codingNote: '1M context, fast, vision for screenshots - best balance',
  },
  {
    id: 'google.gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    family: 'gemini',
    capabilities: { streaming: true, tools: true, vision: true, reasoning: true },
    contextWindow: 1048576,
    speed: 'medium',
    regions: GEMINI_REGIONS,
    codingNote: '1M context, higher quality but slower than Flash',
  },
  {
    id: 'google.gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    family: 'gemini',
    capabilities: { streaming: true, tools: false, vision: true },
    contextWindow: 1048576,
    speed: 'very-fast',
    regions: GEMINI_REGIONS,
    codingNote: 'No tool support - not recommended for coding agents',
  },

  // ==========================================================================
  // Cohere Command models
  // ==========================================================================
  {
    id: 'cohere.command-a-03-2025',
    name: 'Command A (Mar 2025)',
    family: 'cohere',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 256000,
    speed: 'fast',
    regions: COHERE_REGIONS,
    codingRecommended: true,
    codingNote: '256K context, latest Cohere model with tool support',
  },
  {
    id: 'cohere.command-plus-latest',
    name: 'Command+ (Latest)',
    family: 'cohere',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 128000,
    speed: 'fast',
    regions: COHERE_REGIONS,
  },
  {
    id: 'cohere.command-latest',
    name: 'Command (Latest)',
    family: 'cohere',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 128000,
    speed: 'fast',
    regions: COHERE_REGIONS,
  },
  {
    id: 'cohere.command-r-plus-08-2024',
    name: 'Command R+ (Aug 2024)',
    family: 'cohere',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 128000,
    speed: 'fast',
    regions: COHERE_REGIONS,
  },
  {
    id: 'cohere.command-r-08-2024',
    name: 'Command R (Aug 2024)',
    family: 'cohere',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 128000,
    speed: 'fast',
    regions: COHERE_REGIONS,
  },
  {
    id: 'cohere.command-a-reasoning-08-2025',
    name: 'Command A Reasoning',
    family: 'cohere',
    capabilities: { streaming: true, tools: true, vision: false, reasoning: true },
    contextWindow: 256000,
    speed: 'medium',
    regions: COHERE_REGIONS,
    codingNote: 'Enhanced reasoning for complex logic',
  },
  {
    id: 'cohere.command-a-vision-07-2025',
    name: 'Command A Vision',
    family: 'cohere',
    capabilities: { streaming: true, tools: true, vision: true },
    contextWindow: 128000,
    speed: 'medium',
    regions: COHERE_REGIONS,
    dedicatedOnly: true,
  },
  {
    id: 'cohere.command-a-reasoning',
    name: 'Command A Reasoning (Legacy)',
    family: 'cohere',
    capabilities: { streaming: true, tools: true, vision: false, reasoning: true },
    contextWindow: 256000,
    speed: 'medium',
    regions: COHERE_REGIONS,
    dedicatedOnly: true,
  },
  {
    id: 'cohere.command-a-vision',
    name: 'Command A Vision (Legacy)',
    family: 'cohere',
    capabilities: { streaming: true, tools: true, vision: true },
    contextWindow: 131072,
    speed: 'medium',
    regions: COHERE_REGIONS,
    dedicatedOnly: true,
  },
  {
    id: 'cohere.command-r-plus',
    name: 'Command R+ (Latest)',
    family: 'cohere',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 128000,
    speed: 'fast',
    regions: COHERE_REGIONS,
  },
  {
    id: 'cohere.command-r-16k',
    name: 'Command R 16K',
    family: 'cohere',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 16000,
    speed: 'fast',
    regions: COHERE_REGIONS,
    codingNote: 'Small context - not ideal for large codebases',
  },

  // ==========================================================================
  // OpenAI GPT-OSS models
  // ==========================================================================
  {
    id: 'openai.gpt-oss-120b',
    name: 'GPT-OSS 120B',
    family: 'openai',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 131072,
    speed: 'medium',
    regions: OPENAI_REGIONS,
    codingNote: 'OpenAI open-source model - less proven for code',
  },
  {
    id: 'openai.gpt-oss-20b',
    name: 'GPT-OSS 20B',
    family: 'openai',
    capabilities: { streaming: true, tools: true, vision: false },
    contextWindow: 131072,
    speed: 'fast',
    regions: OPENAI_REGIONS,
    codingNote: 'Lightweight OpenAI model',
  },
];

export function isValidModelId(modelId: string): boolean {
  return MODEL_CATALOG.some((m) => m.id === modelId);
}

export function getModelMetadata(modelId: string): ModelMetadata | undefined {
  return MODEL_CATALOG.find((m) => m.id === modelId);
}

export function getAllModels(): ModelMetadata[] {
  return MODEL_CATALOG;
}

export function getModelsByFamily(family: ModelMetadata['family']): ModelMetadata[] {
  return MODEL_CATALOG.filter((m) => m.family === family);
}

/**
 * Get models available in a specific region
 * @param region - OCI region identifier (e.g., 'eu-frankfurt-1')
 * @param includeDedicatedOnly - Include models that require dedicated AI clusters (default: false)
 */
export function getModelsByRegion(
  region: OCIGenAIRegion,
  includeDedicatedOnly = false
): ModelMetadata[] {
  return MODEL_CATALOG.filter(
    (m) => m.regions.includes(region) && (includeDedicatedOnly || !m.dedicatedOnly)
  );
}

/**
 * Get models recommended for coding agents in a specific region.
 * These models have tool support, good code capabilities, and reasonable speed.
 * @param region - OCI region identifier (e.g., 'eu-frankfurt-1')
 */
export function getCodingRecommendedModels(region: OCIGenAIRegion): ModelMetadata[] {
  return MODEL_CATALOG.filter(
    (m) =>
      m.regions.includes(region) &&
      !m.dedicatedOnly &&
      m.capabilities.tools &&
      m.codingRecommended === true
  );
}

/**
 * Check if a model is suitable for coding agents
 * @param modelId - Model ID to check
 */
export function isCodingSuitable(modelId: string): boolean {
  const model = MODEL_CATALOG.find((m) => m.id === modelId);
  if (!model) return false;
  // Must have tool support
  return model.capabilities.tools;
}

/**
 * Check if a model supports reasoning/thinking traces
 * @param modelId - Model ID to check
 * @returns true if the model supports reasoning capabilities
 */
export function supportsReasoning(modelId: string): boolean {
  const model = MODEL_CATALOG.find((m) => m.id === modelId);
  return model?.capabilities.reasoning ?? false;
}
