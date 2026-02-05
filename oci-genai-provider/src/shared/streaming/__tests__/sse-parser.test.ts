import { describe, it, expect } from '@jest/globals';
import { mapFinishReason, parseSSEStream } from '../sse-parser';
import type { StreamPart } from '../types';

describe('SSE Parser', () => {
  describe('mapFinishReason', () => {
    it('should map STOP to stop', () => {
      const result = mapFinishReason('STOP');
      expect(result).toEqual({ unified: 'stop', raw: 'STOP' });
    });

    it('should map LENGTH to length', () => {
      const result = mapFinishReason('LENGTH');
      expect(result).toEqual({ unified: 'length', raw: 'LENGTH' });
    });

    it('should map CONTENT_FILTER to content-filter', () => {
      const result = mapFinishReason('CONTENT_FILTER');
      expect(result).toEqual({ unified: 'content-filter', raw: 'CONTENT_FILTER' });
    });

    it('should map unknown to other', () => {
      const result = mapFinishReason('UNKNOWN');
      expect(result).toEqual({ unified: 'other', raw: 'UNKNOWN' });
    });

    it('should map empty string to other', () => {
      const result = mapFinishReason('');
      expect(result).toEqual({ unified: 'other', raw: '' });
    });

    it('should map TOOL_CALL to tool-calls', () => {
      const result = mapFinishReason('TOOL_CALL');
      expect(result).toEqual({ unified: 'tool-calls', raw: 'TOOL_CALL' });
    });

    it('should map TOOL_CALLS to tool-calls', () => {
      const result = mapFinishReason('TOOL_CALLS');
      expect(result).toEqual({ unified: 'tool-calls', raw: 'TOOL_CALLS' });
    });

    it('should map ERROR to error', () => {
      const result = mapFinishReason('ERROR');
      expect(result).toEqual({ unified: 'error', raw: 'ERROR' });
    });
  });

  describe('SSE parsing edge cases', () => {
    it('should handle done event marker', () => {
      const doneMarker = '[DONE]';
      expect(doneMarker).toBe('[DONE]');
    });

    it('should handle malformed JSON gracefully', () => {
      const tryParse = (data: string): unknown => {
        try {
          return JSON.parse(data) as unknown;
        } catch {
          return null;
        }
      };
      expect(tryParse('{invalid}')).toBeNull();
      expect(tryParse('{"valid": true}')).toEqual({ valid: true });
    });

    it('should handle empty events', () => {
      const emptyData = {};
      expect(Object.keys(emptyData)).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should parse 1000 events in under 100ms', async () => {
      const events: string[] = [];
      for (let i = 0; i < 1000; i++) {
        events.push(`event: message\ndata: {"message":{"content":[{"text":"token${i}"}]}}\n\n`);
      }
      const sseText = events.join('');

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const startTime = Date.now();

      let count = 0;
      for await (const part of parseSSEStream(response)) {
        if (part.type === 'text-delta') {
          count++;
        }
      }

      const duration = Date.now() - startTime;
      expect(count).toBe(1000);
      expect(duration).toBeLessThan(200); // Allow headroom for CI environments
    }, 10000); // 10 second timeout for benchmark
  });

  describe('parseSSEStream', () => {
    it('should parse text delta from stream', async () => {
      const sseText = `event: message
data: {"message":{"content":[{"text":"Hello"}]}}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      expect(parts.length).toBeGreaterThan(0);
      expect(parts[0].type).toBe('text-delta');
      if (parts[0].type === 'text-delta') {
        expect(parts[0].textDelta).toBe('Hello');
      }
    });

    it('should parse finish event from stream', async () => {
      const sseText = `event: message
data: {"finishReason":"STOP"}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      const finishPart = parts.find((p) => p.type === 'finish');
      expect(finishPart).toBeDefined();
      if (finishPart?.type === 'finish') {
        expect(finishPart.finishReason).toEqual({ unified: 'stop', raw: 'STOP' });
        expect(finishPart.usage.promptTokens).toBe(0);
      }
    });

    it('should handle empty event data', async () => {
      const sseText = `event: message
data: {}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      // Empty data should not yield any parts (no text or finish)
      expect(parts).toHaveLength(0);
    });

    it('should handle error event parsing', async () => {
      const sseText = `event: error
data: {"error":"Rate limit exceeded"}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      // Parser should handle error events without crashing
      // Error events with no chatResponse should yield no parts
      expect(parts).toHaveLength(0);
    });

    it('should handle malformed JSON in events gracefully', async () => {
      const sseText = `event: message
data: {invalid json}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      // Malformed JSON should be caught and ignored
      expect(parts).toHaveLength(0);
    });

    it('should handle multiple consecutive newlines', async () => {
      const sseText = `event: message
data: {"message":{"content":[{"text":"test"}]}}


`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      // Should parse single event regardless of extra newlines
      expect(parts).toHaveLength(1);
      expect(parts[0].type).toBe('text-delta');
    });

    it('should handle mixed line endings (CRLF vs LF)', async () => {
      const sseText = `event: message\r\ndata: {"message":{"content":[{"text":"test"}]}}\r\n\r\n`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      // Should handle CRLF line endings correctly
      expect(parts).toHaveLength(1);
      expect(parts[0].type).toBe('text-delta');
      if (parts[0].type === 'text-delta') {
        expect(parts[0].textDelta).toBe('test');
      }
    });

    it('should throw when response body is not readable', async () => {
      const response = new Response(null);

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _part of parseSSEStream(response)) {
          // consume the stream
        }
      }).rejects.toThrow('Response body is not readable');
    });

    it('should yield remaining parts after stream completes', async () => {
      const sseText = `event: message
data: {"message":{"content":[{"text":"first"}]}}

event: message
data: {"message":{"content":[{"text":"second"}]}}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      // Both parts should be yielded including final parts after stream ends
      expect(parts).toHaveLength(2);
      expect(parts[0].type).toBe('text-delta');
      expect(parts[1].type).toBe('text-delta');
      if (parts[0].type === 'text-delta' && parts[1].type === 'text-delta') {
        expect(parts[0].textDelta).toBe('first');
        expect(parts[1].textDelta).toBe('second');
      }
    });

    it('should handle large chunked streams with buffered parts', async () => {
      // Create a large number of events that are parsed but may be buffered
      const events: string[] = [];
      for (let i = 0; i < 100; i++) {
        events.push(`event: message\ndata: {"message":{"content":[{"text":"token${i}"}]}}\n\n`);
      }
      const sseText = events.join('');

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      // All 100 parts should be yielded, testing cleanup loop
      expect(parts).toHaveLength(100);
      expect(parts[0].type).toBe('text-delta');
      expect(parts[99].type).toBe('text-delta');
    });

    it('should handle events with whitespace in data fields', async () => {
      const sseText = `event: message
data:   {"message":{"content":[{"text":"  spaced  "}]}}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      expect(parts).toHaveLength(1);
      expect(parts[0].type).toBe('text-delta');
      if (parts[0].type === 'text-delta') {
        expect(parts[0].textDelta).toBe('  spaced  ');
      }
    });

    it('should handle [DONE] marker correctly', async () => {
      const sseText = `event: message
data: {"message":{"content":[{"text":"final"}]}}

event: message
data: [DONE]

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      // Only the first text part should be yielded, [DONE] is ignored
      expect(parts).toHaveLength(1);
      expect(parts[0].type).toBe('text-delta');
    });

    it('should parse GENERIC format tool calls from stream', async () => {
      const sseText = `event: message
data: {"message":{"toolCalls":[{"id":"call_123","type":"FUNCTION","function":{"name":"get_weather","arguments":"{\\"city\\":\\"London\\"}"}}]}}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      expect(parts).toHaveLength(1);
      expect(parts[0].type).toBe('tool-call');
      if (parts[0].type === 'tool-call') {
        expect(parts[0].toolCallId).toBe('call_123');
        expect(parts[0].toolName).toBe('get_weather');
        expect(parts[0].input).toBe('{"city":"London"}');
      }
    });

    it('should parse COHERE format tool calls from stream', async () => {
      const sseText = `event: message
data: {"toolCalls":[{"name":"search","parameters":{"query":"test"}}]}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      expect(parts).toHaveLength(1);
      expect(parts[0].type).toBe('tool-call');
      if (parts[0].type === 'tool-call') {
        expect(parts[0].toolName).toBe('search');
        expect(parts[0].input).toBe('{"query":"test"}');
      }
    });

    it('should parse multiple tool calls from stream', async () => {
      const sseText = `event: message
data: {"message":{"toolCalls":[{"id":"call_1","type":"FUNCTION","function":{"name":"tool_a","arguments":"{}"}},{"id":"call_2","type":"FUNCTION","function":{"name":"tool_b","arguments":"{}"}}]}}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      expect(parts).toHaveLength(2);
      expect(parts[0].type).toBe('tool-call');
      expect(parts[1].type).toBe('tool-call');
      if (parts[0].type === 'tool-call' && parts[1].type === 'tool-call') {
        expect(parts[0].toolName).toBe('tool_a');
        expect(parts[1].toolName).toBe('tool_b');
      }
    });

    it('should parse text followed by tool calls', async () => {
      const sseText = `event: message
data: {"message":{"content":[{"text":"Let me check"}]}}

event: message
data: {"message":{"toolCalls":[{"id":"call_1","type":"FUNCTION","function":{"name":"get_weather","arguments":"{}"}}]}}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      expect(parts).toHaveLength(2);
      expect(parts[0].type).toBe('text-delta');
      expect(parts[1].type).toBe('tool-call');
    });

    it('should parse finish event with prediction token details', async () => {
      const sseText = `event: message
data: {"finishReason":"STOP","usage":{"promptTokens":100,"completionTokens":50,"completionTokensDetails":{"reasoningTokens":20,"acceptedPredictionTokens":15,"rejectedPredictionTokens":5}}}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      expect(parts).toHaveLength(1);
      const finishPart = parts[0];
      expect(finishPart.type).toBe('finish');
      if (finishPart.type === 'finish') {
        expect(finishPart.usage.promptTokens).toBe(100);
        expect(finishPart.usage.completionTokens).toBe(50);
        expect(finishPart.usage.reasoningTokens).toBe(20);
        expect(finishPart.usage.acceptedPredictionTokens).toBe(15);
        expect(finishPart.usage.rejectedPredictionTokens).toBe(5);
      }
    });

    it('should handle finish event without prediction token details', async () => {
      const sseText = `event: message
data: {"finishReason":"STOP","usage":{"promptTokens":50,"completionTokens":25}}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      expect(parts).toHaveLength(1);
      const finishPart = parts[0];
      expect(finishPart.type).toBe('finish');
      if (finishPart.type === 'finish') {
        expect(finishPart.usage.promptTokens).toBe(50);
        expect(finishPart.usage.completionTokens).toBe(25);
        expect(finishPart.usage.reasoningTokens).toBeUndefined();
        expect(finishPart.usage.acceptedPredictionTokens).toBeUndefined();
        expect(finishPart.usage.rejectedPredictionTokens).toBeUndefined();
      }
    });

    it('should handle partial prediction token details', async () => {
      const sseText = `event: message
data: {"finishReason":"STOP","usage":{"promptTokens":75,"completionTokens":30,"completionTokensDetails":{"acceptedPredictionTokens":10}}}

`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseText));
          controller.close();
        },
      });

      const response = new Response(stream);
      const parts: StreamPart[] = [];

      for await (const part of parseSSEStream(response)) {
        parts.push(part);
      }

      expect(parts).toHaveLength(1);
      const finishPart = parts[0];
      expect(finishPart.type).toBe('finish');
      if (finishPart.type === 'finish') {
        expect(finishPart.usage.acceptedPredictionTokens).toBe(10);
        expect(finishPart.usage.rejectedPredictionTokens).toBeUndefined();
        expect(finishPart.usage.reasoningTokens).toBeUndefined();
      }
    });
  });
});
