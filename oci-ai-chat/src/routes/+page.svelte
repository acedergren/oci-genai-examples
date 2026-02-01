<script lang="ts">
  import { Chat } from '@ai-sdk/svelte';
  import { DefaultChatTransport } from 'ai';
  import type { PageData } from './$types';
  import { Spinner, Badge, ModelPicker } from '$lib/components/ui/index.js';
  import { ThoughtPanel, ReasoningPanel, ToolPanel } from '$lib/components/panels/index.js';
  import type { ToolCall } from '$lib/tools/types.js';

  let { data }: { data: PageData } = $props();

  // Session state
  let localSessions = $state(data.sessions);
  let localSessionId = $state(data.currentSessionId);
  let sidebarOpen = $state(true);
  let sidePanelOpen = $state(true);
  let input = $state('');

  // Panel state
  let thoughtOpen = $state(false);
  let reasoningOpen = $state(false);
  let toolsOpen = $state(true);

  // Model state
  let selectedModel = $state('meta.llama-3.3-70b-instruct');
  let modelPickerOpen = $state(false);
  let availableModels = $state<Array<{ id: string; name: string; description: string }>>([]);
  let currentRegion = $state('loading...');

  // Token usage state
  let sessionTokens = $state({ input: 0, output: 0, cost: 0 });

  // Fetch available models on mount
  $effect(() => {
    fetchAvailableModels();
  });

  // Refresh usage when streaming completes
  let previousStatus = $state<string | undefined>(undefined);
  $effect(() => {
    const status = chat.status;
    // When transitioning from streaming to ready, refresh usage
    if (previousStatus === 'streaming' && status === 'ready') {
      refreshSessionUsage();
      refreshCurrentSession(); // Also refresh title
    }
    previousStatus = status;
  });

  async function fetchAvailableModels() {
    try {
      const response = await fetch('/api/models');
      const { models, region } = await response.json();
      availableModels = models;
      currentRegion = region;
    } catch (error) {
      console.error('Failed to fetch models:', error);
      currentRegion = 'unknown';
    }
  }

  // Agent state (simulated for demo - would come from stream in production)
  let currentThought = $state<string | undefined>(undefined);
  let reasoningSteps = $state<Array<{ id: string; content: string; timestamp: number }>>([]);
  let toolCalls = $state<ToolCall[]>([]);
  let pendingApproval = $state<ToolCall | undefined>(undefined);

  // Initialize Chat
  const chat = new Chat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!input.trim()) return;

    const isFirstMessage = chat.messages.length === 0;

    // Simulate thinking state
    currentThought = 'Analyzing your request...';

    chat.sendMessage({ text: input });
    input = '';

    // Clear thought after a delay
    setTimeout(() => {
      currentThought = undefined;
    }, 2000);

    // Refresh session title after first message
    if (isFirstMessage) {
      // Wait a bit for the backend to update the title
      setTimeout(async () => {
        await refreshCurrentSession();
      }, 1000);
    }
  }

  async function refreshCurrentSession() {
    const response = await fetch('/api/sessions');
    const { sessions } = await response.json();
    localSessions = sessions;
  }

  async function refreshSessionUsage() {
    if (!localSessionId) return;
    try {
      const response = await fetch(`/api/sessions/${localSessionId}/continue`, { method: 'POST' });
      if (!response.ok) return;
      const { usage } = await response.json();
      if (usage) {
        sessionTokens = { input: 0, output: usage.tokens, cost: usage.cost };
      }
    } catch {
      // Ignore errors during refresh
    }
  }

  async function handleNewSession() {
    const response = await fetch('/api/sessions', { method: 'POST' });
    const { session } = await response.json();

    localSessionId = session.id;
    localSessions = [session, ...localSessions];
    chat.messages = [];

    // Reset token usage
    sessionTokens = { input: 0, output: 0, cost: 0 };

    // Clear agent state
    currentThought = undefined;
    reasoningSteps = [];
    toolCalls = [];
    pendingApproval = undefined;
  }

  async function handleSelectSession(id: string) {
    const response = await fetch(`/api/sessions/${id}/continue`, { method: 'POST' });
    const { session, messages, usage } = await response.json();

    localSessionId = session.id;

    // Load the messages into the chat
    // Convert to UIMessage format
    chat.messages = messages.map((msg: { role: string; content: string }, index: number) => ({
      id: `msg-${index}`,
      role: msg.role,
      parts: [{ type: 'text', text: msg.content }],
    }));

    // Update token usage
    if (usage) {
      sessionTokens = { input: 0, output: usage.tokens, cost: usage.cost };
    }

    // Clear agent state
    currentThought = undefined;
    reasoningSteps = [];
    toolCalls = [];
    pendingApproval = undefined;
  }

  async function handleDeleteSession(id: string) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    localSessions = localSessions.filter((s: { id: string }) => s.id !== id);

    if (id === localSessionId) {
      await handleNewSession();
    }
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  function toggleSidePanel() {
    sidePanelOpen = !sidePanelOpen;
  }

  function handleToolApprove(toolId: string) {
    // In production, this would send approval to the server
    pendingApproval = undefined;
  }

  function handleToolReject(toolId: string) {
    pendingApproval = undefined;
  }

  // Keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    // Panel toggles
    if (event.key === 't' && !event.ctrlKey && !event.metaKey && document.activeElement?.tagName !== 'INPUT') {
      event.preventDefault();
      thoughtOpen = !thoughtOpen;
    }
    if (event.key === 'r' && !event.ctrlKey && !event.metaKey && document.activeElement?.tagName !== 'INPUT') {
      event.preventDefault();
      reasoningOpen = !reasoningOpen;
    }
    if (event.key === 'o' && !event.ctrlKey && !event.metaKey && document.activeElement?.tagName !== 'INPUT') {
      event.preventDefault();
      toolsOpen = !toolsOpen;
    }
    if (event.key === 'm' && !event.ctrlKey && !event.metaKey && document.activeElement?.tagName !== 'INPUT') {
      event.preventDefault();
      modelPickerOpen = !modelPickerOpen;
    }

    // Tool approval
    if (pendingApproval) {
      if (event.key === 'y') {
        handleToolApprove(pendingApproval.id);
      } else if (event.key === 'n') {
        handleToolReject(pendingApproval.id);
      }
    }

    // Ctrl+N for new session
    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
      event.preventDefault();
      handleNewSession();
    }
  }

  const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');
  const isThinking = $derived(chat.status === 'submitted');
  const isStreaming = $derived(chat.status === 'streaming');
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-screen bg-primary text-primary overflow-hidden">
  <!-- Sidebar toggle for mobile -->
  <button
    class="fixed top-4 left-4 z-50 lg:hidden btn btn-secondary"
    onclick={toggleSidebar}
    aria-label="Toggle sidebar"
  >
    ☰
  </button>

  <!-- Session sidebar -->
  {#if sidebarOpen}
    <aside
      class="w-64 border-r border-default bg-secondary flex-shrink-0 hidden lg:flex flex-col animate-slide-in-right"
    >
      <div class="p-4 border-b border-muted">
        <div class="flex items-center gap-3">
          <div
            class="h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-primary font-bold"
          >
            ◆
          </div>
          <div>
            <h1 class="font-bold text-lg text-primary">OCI GenAI</h1>
            <p class="text-xs text-tertiary">Agentic Chat</p>
          </div>
        </div>
      </div>

      <!-- New Chat Button -->
      <div class="p-3">
        <button onclick={handleNewSession} class="w-full btn btn-secondary">
          + New Chat
        </button>
      </div>

      <!-- Sessions List -->
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        {#each localSessions as session (session.id)}
          <button
            onclick={() => handleSelectSession(session.id)}
            class="w-full text-left px-3 py-2 text-sm rounded-lg transition-fast group {localSessionId ===
            session.id
              ? 'bg-elevated border border-focused'
              : 'hover:bg-hover border border-transparent'}"
          >
            <div class="flex items-center justify-between">
              <span class="truncate text-primary">{session.title || 'New Chat'}</span>
              {#if localSessionId === session.id}
                <span class="text-accent">●</span>
              {/if}
            </div>
            <div class="flex items-center gap-2 mt-1">
              <Badge variant="default">{session.model.split('.').pop()}</Badge>
            </div>
          </button>
        {/each}
      </div>

    </aside>
  {/if}

  <!-- Main content area -->
  <main class="flex-1 flex overflow-hidden">
    <!-- Chat panel -->
    <div
      class="flex-1 flex flex-col overflow-hidden"
      style:width={sidePanelOpen ? 'var(--panel-chat)' : '100%'}
    >
      <!-- Header -->
      <header class="flex items-center justify-between p-4 border-b border-default bg-secondary">
        <div class="flex items-center gap-3">
          <span class="text-accent font-bold">◆</span>
          <button
            onclick={() => (modelPickerOpen = true)}
            class="hover:opacity-80 transition-fast cursor-pointer"
            title="Change model [m]"
          >
            <Badge variant="default">{selectedModel.split('.').pop()}</Badge>
          </button>
        </div>

        <div class="flex items-center gap-4">
          <!-- Status indicator -->
          <div class="flex items-center gap-2">
            {#if isThinking}
              <Spinner variant="pulse" color="var(--agent-thinking)" />
              <span class="text-thinking text-sm">Thinking</span>
            {:else if isStreaming}
              <Spinner variant="dots" color="var(--agent-streaming)" />
              <span class="text-streaming text-sm">Streaming</span>
            {:else}
              <span class="text-tertiary">○</span>
              <span class="text-tertiary text-sm">Ready</span>
            {/if}
          </div>

          <!-- Toggle side panel -->
          <button
            onclick={toggleSidePanel}
            class="btn btn-secondary text-sm"
            aria-label="Toggle side panel"
          >
            {sidePanelOpen ? '◀' : '▶'}
          </button>
        </div>
      </header>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {#if chat.messages.length === 0}
          <div class="flex items-center justify-center h-full">
            <div class="text-center space-y-4">
              <div class="text-6xl text-accent animate-pulse-glow">◆</div>
              <h2 class="text-xl font-semibold text-primary">OCI GenAI Agent</h2>
              <p class="text-secondary max-w-md">
                Manage your Oracle Cloud Infrastructure resources with natural language.
                Ask me to list instances, create VCNs, manage databases, and more.
              </p>
              <div class="flex flex-wrap justify-center gap-2 mt-4">
                <Badge variant="default">Compute</Badge>
                <Badge variant="default">Networking</Badge>
                <Badge variant="default">Storage</Badge>
                <Badge variant="default">Database</Badge>
                <Badge variant="default">Identity</Badge>
              </div>
            </div>
          </div>
        {:else}
          {#each chat.messages as message, index (index)}
            <div
              class="message flex {message.role === 'user' ? 'justify-end' : 'justify-start'}"
            >
              <div
                class="max-w-[80%] rounded-lg px-4 py-3 {message.role === 'user'
                  ? 'message-user'
                  : 'message-assistant'}"
              >
                <div class="flex items-center gap-2 mb-2">
                  <span class={message.role === 'user' ? 'text-accent' : 'text-primary'}>
                    {message.role === 'user' ? 'You' : 'Agent'}
                  </span>
                  {#if message.role === 'assistant' && index === chat.messages.length - 1 && isStreaming}
                    <Spinner variant="dots" size="sm" color="var(--agent-streaming)" />
                  {/if}
                </div>
                {#each message.parts as part, partIndex (partIndex)}
                  {#if part.type === 'text'}
                    <div class="whitespace-pre-wrap text-primary">{part.text}</div>
                  {:else if part.type === 'tool-invocation'}
                    <div class="message-tool mt-2 rounded px-3 py-2">
                      <div class="flex items-center gap-2">
                        <Badge variant="info">{part.toolInvocation.toolName}</Badge>
                        <span class="text-tertiary text-xs">
                          {part.toolInvocation.state}
                        </span>
                      </div>
                    </div>
                  {/if}
                {/each}
                {#if message.role === 'assistant' && index === chat.messages.length - 1 && isStreaming}
                  <span class="inline-block w-2 h-4 bg-streaming animate-typing-cursor ml-1"></span>
                {/if}
              </div>
            </div>
          {/each}

          {#if isLoading && chat.messages.length > 0 && chat.messages[chat.messages.length - 1].role === 'user'}
            <div class="flex justify-start">
              <div class="message-assistant rounded-lg px-4 py-3">
                <div class="flex items-center gap-2">
                  <Spinner variant="dots" />
                  <span class="text-secondary">Thinking...</span>
                </div>
              </div>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Input form -->
      <form onsubmit={handleSubmit} class="p-4 border-t border-default bg-secondary">
        <div class="flex gap-3">
          <input
            bind:value={input}
            placeholder="Ask about OCI resources..."
            class="chat-input flex-1 px-4 py-3 rounded-lg"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            class="btn btn-primary px-6"
          >
            {#if isLoading}
              <Spinner variant="ring" size="sm" color="var(--bg-primary)" />
            {:else}
              Send
            {/if}
          </button>
        </div>
      </form>
    </div>

    <!-- Side panel (thought, reasoning, tools) -->
    {#if sidePanelOpen}
      <aside
        class="w-80 border-l border-default bg-secondary overflow-y-auto p-3 animate-slide-in-right"
      >
        <ThoughtPanel
          isOpen={thoughtOpen}
          thought={currentThought}
          isThinking={isThinking}
          ontoggle={() => (thoughtOpen = !thoughtOpen)}
        />

        <ReasoningPanel
          isOpen={reasoningOpen}
          steps={reasoningSteps}
          ontoggle={() => (reasoningOpen = !reasoningOpen)}
        />

        <ToolPanel
          isOpen={toolsOpen}
          tools={toolCalls}
          {pendingApproval}
          ontoggle={() => (toolsOpen = !toolsOpen)}
          onapprove={handleToolApprove}
          onreject={handleToolReject}
        />
      </aside>
    {/if}
  </main>
</div>

<!-- Model Picker -->
<ModelPicker
  isOpen={modelPickerOpen}
  currentModel={selectedModel}
  models={availableModels}
  region={currentRegion}
  onselect={(model) => (selectedModel = model)}
  onclose={() => (modelPickerOpen = false)}
/>

<!-- Status bar -->
<footer class="fixed bottom-0 left-0 right-0 h-6 bg-tertiary border-t border-muted px-4 flex items-center justify-between text-xs text-tertiary">
  <div class="flex items-center gap-4">
    <span>[t] thought</span>
    <span>[r] reasoning</span>
    <span>[o] tools</span>
    <span>[m] model</span>
    {#if pendingApproval}
      <span class="text-warning">[y] approve [n] reject</span>
    {/if}
  </div>
  <div class="flex items-center gap-4">
    {#if sessionTokens.input > 0 || sessionTokens.output > 0}
      <span class="text-secondary">{sessionTokens.input + sessionTokens.output} tokens</span>
      {#if sessionTokens.cost > 0}
        <span class="text-accent">${sessionTokens.cost.toFixed(4)}</span>
      {/if}
    {/if}
    <span>{currentRegion}</span>
  </div>
</footer>
