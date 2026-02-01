import { render } from '@testing-library/svelte/svelte5';
import { describe, it, expect } from 'vitest';
import ChatInput from './ChatInput.svelte';

describe('ChatInput Component', () => {
  it('renders textarea input', () => {
    const { getByLabelText } = render(ChatInput, {
      props: {
        value: '',
        onSubmit: () => {},
      }
    });
    const textarea = getByLabelText('Chat message input');
    expect(textarea).toBeTruthy();
  });

  it('binds textarea value', () => {
    const { getByLabelText } = render(ChatInput, {
      props: {
        value: 'Hello',
        onSubmit: () => {},
      }
    });
    const textarea = getByLabelText('Chat message input') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Hello');
  });

  it('renders send button', () => {
    const { getByLabelText } = render(ChatInput, {
      props: {
        value: 'Test message',
        onSubmit: () => {},
      }
    });
    const sendButton = getByLabelText('Send message');
    expect(sendButton).toBeTruthy();
  });

  it('disables send button when input is empty', () => {
    const { getByLabelText } = render(ChatInput, {
      props: {
        value: '',
        onSubmit: () => {},
      }
    });
    const sendButton = getByLabelText('Send message') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it('enables send button when input has text', () => {
    const { getByLabelText } = render(ChatInput, {
      props: {
        value: 'Some text',
        onSubmit: () => {},
      }
    });
    const sendButton = getByLabelText('Send message') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
  });

  it('disables send button when disabled prop is true', () => {
    const { getByLabelText } = render(ChatInput, {
      props: {
        value: 'Some text',
        onSubmit: () => {},
        disabled: true,
      }
    });
    const sendButton = getByLabelText('Send message') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it('disables textarea when disabled prop is true', () => {
    const { getByLabelText } = render(ChatInput, {
      props: {
        value: '',
        onSubmit: () => {},
        disabled: true,
      }
    });
    const textarea = getByLabelText('Chat message input') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it('renders form element', () => {
    const { container } = render(ChatInput, {
      props: {
        value: 'Test',
        onSubmit: () => {},
      }
    });
    const form = container.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('has text content in send button', () => {
    const { getByLabelText } = render(ChatInput, {
      props: {
        value: 'Test',
        onSubmit: () => {},
      }
    });
    const sendButton = getByLabelText('Send message');
    expect(sendButton.textContent).toBe('Send');
  });
});
