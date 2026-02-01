import { render } from '@testing-library/svelte/svelte5';
import { describe, it, expect } from 'vitest';
import ChatContainer from './ChatContainer.svelte';

describe('ChatContainer Component', () => {
  it('renders empty state when no messages', () => {
    const { getByText } = render(ChatContainer, {
      props: {
        messages: [],
        isLoading: false,
      }
    });

    expect(getByText('Start chatting with OCI GenAI...')).toBeTruthy();
  });

  it('renders messages', () => {
    const messages = [
      {
        id: '1',
        role: 'user' as const,
        parts: [{ type: 'text', text: 'Hello' }]
      },
      {
        id: '2',
        role: 'assistant' as const,
        parts: [{ type: 'text', text: 'Hi there!' }]
      }
    ];

    const { getByText } = render(ChatContainer, {
      props: {
        messages,
        isLoading: false,
      }
    });

    expect(getByText('Hello')).toBeTruthy();
    expect(getByText('Hi there!')).toBeTruthy();
  });

  it('marks last assistant message as streaming when loading', () => {
    const messages = [
      {
        id: '1',
        role: 'user' as const,
        parts: [{ type: 'text', text: 'What is AI?' }]
      },
      {
        id: '2',
        role: 'assistant' as const,
        parts: [{ type: 'text', text: 'AI is...' }]
      }
    ];

    const { container } = render(ChatContainer, {
      props: {
        messages,
        isLoading: true,
      }
    });

    // Check if shimmer animation class is applied to last message
    const lastMessage = container.querySelector('div[class*="shimmer"]');
    expect(lastMessage).toBeTruthy();
  });

  it('extracts text from message parts', () => {
    const messages = [
      {
        id: '1',
        role: 'user' as const,
        parts: [
          { type: 'text', text: 'First part' },
          { type: 'text', text: ' Second part' }
        ]
      }
    ];

    const { getByText } = render(ChatContainer, {
      props: {
        messages,
        isLoading: false,
      }
    });

    expect(getByText('First part Second part')).toBeTruthy();
  });

  it('ignores non-text message parts', () => {
    const messages = [
      {
        id: '1',
        role: 'user' as const,
        parts: [
          { type: 'text', text: 'Check this' },
          { type: 'file', name: 'image.png' }
        ]
      }
    ];

    const { getByText } = render(ChatContainer, {
      props: {
        messages,
        isLoading: false,
      }
    });

    expect(getByText('Check this')).toBeTruthy();
  });
});
