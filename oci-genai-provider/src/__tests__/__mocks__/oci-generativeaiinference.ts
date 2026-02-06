export class GenerativeAiInferenceClient {
  constructor(_params: { authenticationDetailsProvider: unknown }) {
    // Mock client - no actual implementation
  }

  chat(_request: unknown): Promise<unknown> {
    // Mock chat method
    return Promise.resolve({});
  }
}

export class ChatRequest {
  constructor(public body: unknown) {}
}

export class ChatDetails {
  constructor(
    public servingMode: unknown,
    public compartmentId: string,
    public chatRequest: unknown
  ) {}
}

export class OnDemandServingMode {
  constructor(public modelId: string) {}
  static readonly modelType = 'ON_DEMAND';
}

export class DedicatedServingMode {
  constructor(public endpointId: string) {}
  static readonly modelType = 'DEDICATED';
}

export class Message {
  constructor(
    public role: string,
    public content: Array<{ type: string; text?: string }>
  ) {}
}

export class BaseChatRequest {
  constructor(
    public messages: unknown[],
    public maxTokens?: number,
    public temperature?: number,
    public topP?: number,
    public topK?: number,
    public frequencyPenalty?: number,
    public presencePenalty?: number,
    public stop?: string[],
    public isStream?: boolean
  ) {}
}

export class CohereChatRequest extends BaseChatRequest {}
export class LlamaChatRequest extends BaseChatRequest {}

// GenericChatRequest with ReasoningEffort enum to match SDK structure
export class GenericChatRequest extends BaseChatRequest {
  reasoningEffort?: GenericChatRequest.ReasoningEffort;
}

/* eslint-disable no-redeclare */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace GenericChatRequest {
  export enum ReasoningEffort {
    None = 'NONE',
    Minimal = 'MINIMAL',
    Low = 'LOW',
    Medium = 'MEDIUM',
    High = 'HIGH',
  }
}

// CohereChatRequestV2 with thinking support
export class CohereChatRequestV2 extends BaseChatRequest {
  thinking?: CohereThinkingV2;
}

// CohereThinkingV2 interface and Type enum to match SDK structure
export interface CohereThinkingV2 {
  type: CohereThinkingV2.Type;
  tokenBudget?: number;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace CohereThinkingV2 {
  export enum Type {
    Enabled = 'ENABLED',
    Disabled = 'DISABLED',
  }
}
/* eslint-enable no-redeclare */

// Export models namespace to match SDK structure
// This allows imports like: import { models as OCIModel } from 'oci-generativeaiinference'
export const models = {
  ChatRequest,
  ChatDetails,
  OnDemandServingMode,
  DedicatedServingMode,
  Message,
  BaseChatRequest,
  CohereChatRequest,
  CohereChatRequestV2,
  CohereThinkingV2,
  LlamaChatRequest,
  GenericChatRequest,
};
