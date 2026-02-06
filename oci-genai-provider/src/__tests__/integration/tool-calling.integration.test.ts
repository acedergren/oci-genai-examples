import { describe, it, expect } from '@jest/globals';
import type { LanguageModelV3FunctionTool, LanguageModelV3ToolChoice } from '@ai-sdk/provider';
import {
  convertToOCITools,
  convertToOCIToolChoice,
  convertFromOCIToolCalls,
  supportsToolCalling,
} from '../../language-models/converters/tools';
import { convertToOCIMessages } from '../../language-models/converters/messages';
import type { OCIFunctionCall, OCICohereToolCall } from '../../language-models/converters/tools';

describe('Tool Calling Integration', () => {
  describe('Complete Tool Calling Workflow - GENERIC Format', () => {
    const tools: LanguageModelV3FunctionTool[] = [
      {
        type: 'function',
        name: 'get_weather',
        description: 'Get current weather for a location',
        inputSchema: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'City name' },
            unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
          },
          required: ['city'],
        },
      },
      {
        type: 'function',
        name: 'search_database',
        description: 'Search the database for records',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'number' },
          },
          required: ['query'],
        },
      },
    ];

    it('should convert tools to OCI format and back', () => {
      // Convert to OCI format
      const ociTools = convertToOCITools(tools, 'GENERIC');

      expect(ociTools).toHaveLength(2);
      expect(ociTools[0]).toMatchObject({
        type: 'FUNCTION',
        name: 'get_weather',
        description: 'Get current weather for a location',
      });

      // Simulate OCI response with tool calls
      const ociToolCalls: OCIFunctionCall[] = [
        {
          id: 'call_abc123',
          type: 'FUNCTION',
          function: {
            name: 'get_weather',
            arguments: JSON.stringify({ city: 'London', unit: 'celsius' }),
          },
        },
      ];

      // Convert back to AI SDK format
      const sdkToolCalls = convertFromOCIToolCalls(ociToolCalls, 'GENERIC');

      expect(sdkToolCalls).toHaveLength(1);
      expect(sdkToolCalls[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'call_abc123',
        toolName: 'get_weather',
        input: '{"city":"London","unit":"celsius"}',
      });
    });

    it('should handle tool choice conversion', () => {
      const choices: LanguageModelV3ToolChoice[] = [
        { type: 'auto' },
        { type: 'required' },
        { type: 'none' },
        { type: 'tool', toolName: 'get_weather' },
      ];

      const expected = [
        { type: 'AUTO' },
        { type: 'REQUIRED' },
        { type: 'NONE' },
        { type: 'FUNCTION', function: { name: 'get_weather' } },
      ];

      choices.forEach((choice, i) => {
        expect(convertToOCIToolChoice(choice)).toEqual(expected[i]);
      });
    });

    it('should convert messages with tool results', () => {
      const prompt = [
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: "What's the weather in London?" }],
        },
        {
          role: 'assistant' as const,
          content: [
            { type: 'text' as const, text: 'Let me check the weather.' },
            {
              type: 'tool-call' as const,
              toolCallId: 'call_123',
              toolName: 'get_weather',
              input: { city: 'London' },
            },
          ],
        },
        {
          role: 'tool' as const,
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: 'call_123',
              toolName: 'get_weather',
              output: {
                type: 'text' as const,
                value: '{"temperature": 15, "condition": "cloudy"}',
              },
            },
          ],
        },
      ];

      const ociMessages = convertToOCIMessages(prompt);

      expect(ociMessages).toHaveLength(3);

      // User message
      expect(ociMessages[0].role).toBe('USER');

      // Assistant message with tool call
      expect(ociMessages[1].role).toBe('ASSISTANT');
      expect(ociMessages[1].toolCalls).toHaveLength(1);
      expect(ociMessages[1].toolCalls?.[0].function.name).toBe('get_weather');

      // Tool result message
      expect(ociMessages[2].role).toBe('TOOL');
      expect(ociMessages[2].toolCallId).toBe('call_123');
      expect(ociMessages[2].content[0].text).toBe('{"temperature": 15, "condition": "cloudy"}');
    });
  });

  describe('Complete Tool Calling Workflow - COHERE Format', () => {
    const tools: LanguageModelV3FunctionTool[] = [
      {
        type: 'function',
        name: 'web_search',
        description: 'Search the web',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
    ];

    it('should convert tools to Cohere format and back', () => {
      // Convert to Cohere format
      const ociTools = convertToOCITools(tools, 'COHERE');

      expect(ociTools).toHaveLength(1);
      expect(ociTools[0]).toMatchObject({
        name: 'web_search',
        description: 'Search the web',
        parameterDefinitions: {
          query: { type: 'string', description: 'Search query', required: true },
        },
      });

      // Simulate Cohere response with tool calls
      const cohereToolCalls: OCICohereToolCall[] = [
        {
          name: 'web_search',
          parameters: { query: 'OCI GenAI models' },
        },
      ];

      // Convert back to AI SDK format
      const sdkToolCalls = convertFromOCIToolCalls(cohereToolCalls, 'COHERE');

      expect(sdkToolCalls).toHaveLength(1);
      expect(sdkToolCalls[0]).toMatchObject({
        type: 'tool-call',
        toolName: 'web_search',
        input: '{"query":"OCI GenAI models"}',
      });
      // Cohere generates IDs
      expect(sdkToolCalls[0].toolCallId).toMatch(/^tool-call-/);
    });
  });

  describe('Model Support Detection', () => {
    it('should correctly identify tool-supporting models', () => {
      const supported = [
        'meta.llama-3.1-70b-instruct',
        'meta.llama-3.2-90b-instruct',
        'meta.llama-3.3-70b-instruct',
        'cohere.command-r-plus',
        'cohere.command-r',
        'cohere.command-r-08-2024',
        'xai.grok-3',
        'xai.grok-4-maverick',
        'google.gemini-1.5-pro',
        'google.gemini-2.0-flash',
      ];

      const unsupported = [
        'meta.llama-3.0-70b-instruct',
        'meta.llama-2-70b-chat',
        'cohere.command',
        'cohere.command-light',
        'unknown.model',
      ];

      supported.forEach((modelId) => {
        expect(supportsToolCalling(modelId)).toBe(true);
      });

      unsupported.forEach((modelId) => {
        expect(supportsToolCalling(modelId)).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tool list', () => {
      const tools: LanguageModelV3FunctionTool[] = [];
      const ociTools = convertToOCITools(tools, 'GENERIC');
      expect(ociTools).toHaveLength(0);
    });

    it('should handle tools with no parameters', () => {
      const tools: LanguageModelV3FunctionTool[] = [
        {
          type: 'function',
          name: 'get_time',
          description: 'Get current time',
          inputSchema: { type: 'object', properties: {} },
        },
      ];

      const genericTools = convertToOCITools(tools, 'GENERIC');
      expect(genericTools[0]).toMatchObject({
        type: 'FUNCTION',
        name: 'get_time',
      });

      const cohereTools = convertToOCITools(tools, 'COHERE');
      expect(cohereTools[0]).toMatchObject({
        name: 'get_time',
      });
      // Cohere should not have parameterDefinitions for empty properties
      expect(
        (cohereTools[0] as { parameterDefinitions?: unknown }).parameterDefinitions
      ).toBeUndefined();
    });

    it('should handle malformed tool call arguments', () => {
      const ociToolCalls: OCIFunctionCall[] = [
        {
          id: 'call_bad',
          type: 'FUNCTION',
          function: {
            name: 'test',
            arguments: 'not valid json',
          },
        },
      ];

      // Should not throw, just pass through the invalid JSON
      const sdkToolCalls = convertFromOCIToolCalls(ociToolCalls, 'GENERIC');
      expect(sdkToolCalls[0].input).toBe('not valid json');
    });

    it('should handle undefined input in tool calls', () => {
      const ociToolCalls: OCIFunctionCall[] = [
        {
          id: 'call_empty',
          type: 'FUNCTION',
          function: {
            name: 'no_args',
            arguments: '',
          },
        },
      ];

      const sdkToolCalls = convertFromOCIToolCalls(ociToolCalls, 'GENERIC');
      expect(sdkToolCalls[0].input).toBe('');
    });
  });
});
