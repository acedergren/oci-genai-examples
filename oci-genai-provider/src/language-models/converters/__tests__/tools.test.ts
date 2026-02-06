import { describe, it, expect } from '@jest/globals';
import {
  convertToOCITools,
  convertToOCIToolChoice,
  convertFromOCIToolCalls,
  supportsToolCalling,
} from '../tools';
import type { LanguageModelV3FunctionTool, LanguageModelV3ToolChoice } from '@ai-sdk/provider';

describe('Tool Converters', () => {
  describe('convertToOCITools', () => {
    it('should convert AI SDK function tools to OCI GENERIC format', () => {
      const tools: LanguageModelV3FunctionTool[] = [
        {
          type: 'function',
          name: 'get_weather',
          description: 'Get current weather for a location',
          inputSchema: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
            },
            required: ['location'],
          },
        },
      ];

      const result = convertToOCITools(tools, 'GENERIC');

      expect(result).toEqual([
        {
          type: 'FUNCTION',
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
            },
            required: ['location'],
          },
        },
      ]);
    });

    it('should convert AI SDK function tools to OCI COHERE format', () => {
      const tools: LanguageModelV3FunctionTool[] = [
        {
          type: 'function',
          name: 'search_database',
          description: 'Search the database',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              limit: { type: 'number', description: 'Max results' },
            },
            required: ['query'],
          },
        },
      ];

      const result = convertToOCITools(tools, 'COHERE');

      expect(result).toEqual([
        {
          name: 'search_database',
          description: 'Search the database',
          parameterDefinitions: {
            query: { type: 'string', description: 'Search query', required: true },
            limit: { type: 'number', description: 'Max results', required: false },
          },
        },
      ]);
    });

    it('should handle tools with no properties', () => {
      const tools: LanguageModelV3FunctionTool[] = [
        {
          type: 'function',
          name: 'get_time',
          description: 'Get current time',
          inputSchema: { type: 'object', properties: {} },
        },
      ];

      const result = convertToOCITools(tools, 'GENERIC');

      expect(result[0]).toMatchObject({
        type: 'FUNCTION',
        name: 'get_time',
      });
    });

    it('should handle tools with no description', () => {
      const tools: LanguageModelV3FunctionTool[] = [
        {
          type: 'function',
          name: 'simple_tool',
          inputSchema: { type: 'object', properties: {} },
        },
      ];

      const result = convertToOCITools(tools, 'GENERIC');

      expect(result[0]).toMatchObject({
        name: 'simple_tool',
        description: '',
      });
    });
  });

  describe('convertToOCIToolChoice', () => {
    it('should convert auto tool choice', () => {
      const choice: LanguageModelV3ToolChoice = { type: 'auto' };
      expect(convertToOCIToolChoice(choice)).toEqual({ type: 'AUTO' });
    });

    it('should convert required tool choice', () => {
      const choice: LanguageModelV3ToolChoice = { type: 'required' };
      expect(convertToOCIToolChoice(choice)).toEqual({ type: 'REQUIRED' });
    });

    it('should convert none tool choice', () => {
      const choice: LanguageModelV3ToolChoice = { type: 'none' };
      expect(convertToOCIToolChoice(choice)).toEqual({ type: 'NONE' });
    });

    it('should convert tool-specific choice', () => {
      const choice: LanguageModelV3ToolChoice = { type: 'tool', toolName: 'get_weather' };
      expect(convertToOCIToolChoice(choice)).toEqual({
        type: 'FUNCTION',
        function: { name: 'get_weather' },
      });
    });
  });

  describe('convertFromOCIToolCalls', () => {
    it('should convert OCI GENERIC format tool calls to AI SDK format', () => {
      const ociToolCalls = [
        {
          id: 'call_123',
          type: 'FUNCTION' as const,
          function: {
            name: 'get_weather',
            arguments: '{"location":"London"}',
          },
        },
      ];

      const result = convertFromOCIToolCalls(ociToolCalls, 'GENERIC');

      expect(result).toEqual([
        {
          type: 'tool-call',
          toolCallId: 'call_123',
          toolName: 'get_weather',
          input: '{"location":"London"}',
        },
      ]);
    });

    it('should convert OCI COHERE format tool calls to AI SDK format', () => {
      const ociToolCalls = [
        {
          name: 'search_database',
          parameters: { query: 'test', limit: 10 },
        },
      ];

      const result = convertFromOCIToolCalls(ociToolCalls, 'COHERE');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'tool-call',
        toolName: 'search_database',
        input: '{"query":"test","limit":10}',
      });
      // COHERE doesn't provide IDs, so we generate them
      expect(result[0].toolCallId).toMatch(/^tool-call-/);
    });

    it('should handle invalid JSON in arguments gracefully', () => {
      const ociToolCalls = [
        {
          id: 'call_456',
          type: 'FUNCTION' as const,
          function: {
            name: 'test_func',
            arguments: 'invalid json',
          },
        },
      ];

      const result = convertFromOCIToolCalls(ociToolCalls, 'GENERIC');

      expect(result[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'call_456',
        toolName: 'test_func',
        input: 'invalid json',
      });
    });

    it('should handle multiple tool calls', () => {
      const ociToolCalls = [
        {
          id: 'call_1',
          type: 'FUNCTION' as const,
          function: { name: 'tool_a', arguments: '{"x":1}' },
        },
        {
          id: 'call_2',
          type: 'FUNCTION' as const,
          function: { name: 'tool_b', arguments: '{"y":2}' },
        },
      ];

      const result = convertFromOCIToolCalls(ociToolCalls, 'GENERIC');

      expect(result).toHaveLength(2);
      expect(result[0].toolName).toBe('tool_a');
      expect(result[1].toolName).toBe('tool_b');
    });
  });

  describe('supportsToolCalling', () => {
    it('should return true for Llama 3.1+ models with tool support', () => {
      expect(supportsToolCalling('meta.llama-3.1-70b-instruct')).toBe(true);
      expect(supportsToolCalling('meta.llama-3.2-90b-vision-instruct')).toBe(true);
      expect(supportsToolCalling('meta.llama-3.3-70b-instruct')).toBe(true);
    });

    it('should return false for models not in registry', () => {
      // Models not in registry return false (unknown capabilities)
      expect(supportsToolCalling('meta.llama-3.0-70b-instruct')).toBe(false);
      expect(supportsToolCalling('meta.llama-2-70b-chat')).toBe(false);
    });

    it('should return true for Cohere Command models with tool support', () => {
      expect(supportsToolCalling('cohere.command-r-plus')).toBe(true);
      expect(supportsToolCalling('cohere.command-r-08-2024')).toBe(true);
      expect(supportsToolCalling('cohere.command-a-03-2025')).toBe(true);
    });

    it('should return false for Cohere models not in registry', () => {
      // Legacy/non-existent models return false
      expect(supportsToolCalling('cohere.command')).toBe(false);
      expect(supportsToolCalling('cohere.command-light')).toBe(false);
    });

    it('should return true for Grok models with tool support', () => {
      expect(supportsToolCalling('xai.grok-3')).toBe(true);
      expect(supportsToolCalling('xai.grok-4')).toBe(true);
      expect(supportsToolCalling('xai.grok-4-fast-reasoning')).toBe(true);
    });

    it('should return false for Grok models without tool support', () => {
      // grok-3-mini explicitly has tools: false in registry
      expect(supportsToolCalling('xai.grok-3-mini')).toBe(false);
      expect(supportsToolCalling('xai.grok-3-mini-fast')).toBe(false);
    });

    it('should return true for Gemini models with tool support', () => {
      expect(supportsToolCalling('google.gemini-2.5-pro')).toBe(true);
      expect(supportsToolCalling('google.gemini-2.5-flash')).toBe(true);
    });

    it('should return false for Gemini models without tool support', () => {
      // gemini-2.5-flash-lite explicitly has tools: false in registry
      expect(supportsToolCalling('google.gemini-2.5-flash-lite')).toBe(false);
    });

    it('should return false for unknown models', () => {
      expect(supportsToolCalling('unknown.model')).toBe(false);
    });
  });
});
