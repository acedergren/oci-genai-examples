import type { LanguageModelV3FinishReason } from '@ai-sdk/provider';

export interface TextDeltaPart {
  type: 'text-delta';
  textDelta: string;
}

export interface ReasoningDeltaPart {
  type: 'reasoning-delta';
  reasoningDelta: string;
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: string; // JSON stringified args
}

export interface FinishPart {
  type: 'finish';
  finishReason: LanguageModelV3FinishReason;
  usage: {
    promptTokens: number;
    completionTokens: number;
    reasoningTokens?: number;
    /** Number of prediction tokens accepted by the model */
    acceptedPredictionTokens?: number;
    /** Number of prediction tokens rejected by the model */
    rejectedPredictionTokens?: number;
  };
}

export interface RawPart {
  type: 'raw';
  rawValue: unknown;
}

export type StreamPart = TextDeltaPart | ReasoningDeltaPart | ToolCallPart | FinishPart | RawPart;

/**
 * Unified finish reason values matching AI SDK v3 spec.
 * Used for the 'unified' field of LanguageModelV3FinishReason.
 */
export type UnifiedFinishReason =
  | 'stop'
  | 'length'
  | 'content-filter'
  | 'tool-calls'
  | 'error'
  | 'other';
