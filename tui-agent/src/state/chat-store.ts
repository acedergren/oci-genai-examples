import { create } from 'zustand';
import type { ChatMessage } from '../components/chat/index.js';

export interface ChatState {
  // Messages
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id'>) => ChatMessage;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;

  // Streaming state
  streamingMessageId: string | undefined;
  setStreamingMessageId: (id: string | undefined) => void;
  appendToStreamingMessage: (text: string) => void;

  // Input focus
  inputFocused: boolean;
  setInputFocused: (focused: boolean) => void;
}

let messageCounter = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  messages: [],
  streamingMessageId: undefined,
  inputFocused: true,

  // Actions
  addMessage: (message) => {
    const id = `msg-${++messageCounter}`;
    const newMessage: ChatMessage = { ...message, id };

    set((state) => ({
      messages: [...state.messages, newMessage],
    }));

    return newMessage;
  },

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  clearMessages: () =>
    set({
      messages: [],
      streamingMessageId: undefined,
    }),

  setStreamingMessageId: (streamingMessageId) => set({ streamingMessageId }),

  appendToStreamingMessage: (text) => {
    const state = get();
    if (!state.streamingMessageId) return;

    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === state.streamingMessageId
          ? { ...m, content: m.content + text }
          : m
      ),
    }));
  },

  setInputFocused: (inputFocused) => set({ inputFocused }),
}));
