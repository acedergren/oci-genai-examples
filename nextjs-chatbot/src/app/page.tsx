'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useMemo, type FormEvent } from 'react';

const MODELS = [
  { id: 'meta.llama-3.3-70b-instruct', name: 'Llama 3.3 70B (General Purpose)' },
  { id: 'cohere.command-r-plus', name: 'Command R+ (RAG Specialized)' },
  { id: 'xai.grok-4', name: 'Grok 4 (Advanced Reasoning)' },
  { id: 'google.gemini-2.5-flash', name: 'Gemini 2.5 Flash (Multimodal)' },
];

export default function Chat() {
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [input, setInput] = useState('');

  // Create transport with selected model in body
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { model: selectedModel },
      }),
    [selectedModel]
  );

  const { messages, sendMessage, status } = useChat({
    transport,
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage({ text: input });
      setInput('');
    }
  };

  return (
    <main className="flex flex-col h-screen max-w-3xl mx-auto p-4">
      <header className="flex justify-between items-center mb-4 pb-4 border-b border-border">
        <h1 className="text-xl font-semibold">OCI GenAI Chat</h1>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </header>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <p className="text-text-secondary text-center py-8">
            Send a message to start chatting with {MODELS.find((m) => m.id === selectedModel)?.name}
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-4 rounded-lg ${
              m.role === 'user' ? 'bg-accent-primary/20 ml-8' : 'bg-surface-raised mr-8'
            }`}
          >
            <p className="text-xs text-text-secondary mb-1">{m.role === 'user' ? 'You' : 'AI'}</p>
            <p className="whitespace-pre-wrap">
              {m.parts?.map((part) => (part.type === 'text' ? part.text : null)).join('') || ''}
            </p>
          </div>
        ))}
        {isLoading && (
          <div className="bg-surface-raised p-4 rounded-lg mr-8 animate-pulse">
            <p className="text-text-secondary">Thinking...</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-surface-raised border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent-primary"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-accent-primary text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 transition-opacity"
        >
          Send
        </button>
      </form>
    </main>
  );
}
