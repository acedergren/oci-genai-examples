<script lang="ts">
  import { Chat } from '@ai-sdk/svelte';
  import { DefaultChatTransport } from 'ai';
  import { useModels } from '$lib/query/hooks.js';
  import { extractToolParts, getToolState, formatToolName as formatToolType } from '$lib/utils/message-parts.js';
  import SearchBox from '$lib/components/ui/SearchBox.svelte';
  import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
import { WORKFLOW_TEMPLATES, createPlanFromTemplate, type WorkflowTemplate, getWorkflowIconSvg } from '$lib/workflows/index.js';
import { AgentWorkflowPanel } from '$lib/components/panels/index.js';
import type { AgentPlan } from '$lib/components/panels/types.js';

  // Models query
  const modelsQuery = useModels();
  const availableModels = $derived($modelsQuery.data?.models ?? []);

  // Chat state
  let selectedModel = $state('meta.llama-3.3-70b-instruct');
  let searchFocused = $state(false);
  let showCommandPalette = $state(false);
  let searchInput = $state('');
  let loadingAction = $state<string | null>(null);
  let hideToolExecution = $state(true); // Hide tool calling UI, show only results

  // Workflow state
  let activeWorkflowPlan = $state<AgentPlan | undefined>(undefined);
  let workflowPanelOpen = $state(true);

  // Featured workflows (top 4)
  const featuredWorkflows = WORKFLOW_TEMPLATES.filter(w => 
    ['cloud-cost-comparison', 'provision-web-server', 'setup-autonomous-database', 'setup-private-network'].includes(w.id)
  );

  // Custom fetch that injects the current model into request body
  const modelAwareFetch: typeof fetch = async (input, init) => {
    if (init?.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        body.model = selectedModel;
        init = { ...init, body: JSON.stringify(body) };
      } catch {
        // Not JSON, pass through
      }
    }
    return fetch(input, init);
  };

  // Initialize chat with AI SDK
  const chat = new Chat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: modelAwareFetch,
    }),
  });

  // Service categories for the portal
  const serviceCategories = [
    {
      id: 'compute',
      title: 'Compute Resources',
      description: 'Virtual machines, containers, and serverless functions',
      icon: 'server',
      color: 'teal',
      actions: ['Launch Instance', 'Stop Instance', 'List Instances'],
    },
    {
      id: 'database',
      title: 'Database Services',
      description: 'Autonomous databases, MySQL, and NoSQL options',
      icon: 'database',
      color: 'indigo',
      actions: ['Create Database', 'List Databases', 'Scale Database'],
    },
    {
      id: 'networking',
      title: 'Networking',
      description: 'VCNs, load balancers, and DNS management',
      icon: 'network',
      color: 'emerald',
      actions: ['Create VCN', 'List Subnets', 'Configure Security'],
    },
    {
      id: 'storage',
      title: 'Object Storage',
      description: 'Buckets, file systems, and block volumes',
      icon: 'storage',
      color: 'amber',
      actions: ['Create Bucket', 'List Buckets', 'Upload Files'],
    },
    {
      id: 'identity',
      title: 'Identity & Access',
      description: 'Users, groups, policies, and compartments',
      icon: 'shield',
      color: 'rose',
      actions: ['List Compartments', 'Create Policy', 'Manage Users'],
    },
    {
      id: 'monitoring',
      title: 'Monitoring & Alerts',
      description: 'Metrics, alarms, and log analytics',
      icon: 'chart',
      color: 'violet',
      actions: ['View Metrics', 'Create Alarm', 'Query Logs'],
    },
  ];

  // Quick actions for common tasks
  const quickActions = [
    { label: 'List my instances', prompt: 'List all my compute instances' },
    { label: 'Check databases', prompt: 'Show me my autonomous databases' },
    { label: 'View compartments', prompt: 'List my compartments' },
    { label: 'Network overview', prompt: 'Give me an overview of my VCNs and subnets' },
    { label: 'Compare OCI vs Azure', prompt: 'Compare OCI and Azure costs for a 4 vCPU, 16GB RAM web server running 24/7' },
    { label: 'OCI Free Tier', prompt: 'What does OCI Always Free tier include?' },
  ];

  // Recent activity (mock data - would come from session history)
  const recentActivity = [
    { id: 'REQ001', type: 'compute', action: 'Listed Instances', time: '5 mins ago', status: 'completed' },
    { id: 'REQ002', type: 'database', action: 'Created ADB', time: '1 hour ago', status: 'completed' },
    { id: 'REQ003', type: 'networking', action: 'VCN Query', time: '2 hours ago', status: 'completed' },
  ];

  // Handle search/command submission
  function handleSearch(e: Event) {
    e.preventDefault();
    const query = searchInput.trim();
    
    if (query) {
      showCommandPalette = true;
      chat.sendMessage({ text: query });
      searchInput = '';
    }
  }

  // Handle quick action click
  function handleQuickAction(prompt: string) {
    showCommandPalette = true;
    loadingAction = prompt;
    chat.sendMessage({ text: prompt });

    // Keep loading state visible for at least 300ms for better UX
    setTimeout(() => {
      loadingAction = null;
    }, 300);
  }

  // Handle service category action
  function handleServiceAction(action: string) {
    const prompt = action.toLowerCase().includes('list') 
      ? action 
      : `Help me ${action.toLowerCase()}`;
    handleQuickAction(prompt);
  }

  // Handle follow-up chat submission
  function handleChatSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    const text = input.value.trim();
    
    if (text) {
      chat.sendMessage({ text });
      input.value = '';
    }
  }

  // Toggle tool execution visibility (Ctrl+Shift+T for debug/development)
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      hideToolExecution = !hideToolExecution;
    }
  }

  // Handle workflow start
  function handleStartWorkflow(template: WorkflowTemplate) {
    activeWorkflowPlan = createPlanFromTemplate(template);
    showCommandPalette = true;
    const prompt = `Help me ${template.name.toLowerCase()}. ${template.description}`;
    chat.sendMessage({ text: prompt });
  }

  // Extract text content from message parts
  function getMessageText(message: typeof chat.messages[number]): string {
    if (!message.parts) return '';
    return message.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('\n');
  }

  // Extract tool parts from message using utility function
  function getToolParts(message: typeof chat.messages[number]) {
    if (!message.parts) return [];
    return extractToolParts(message.parts as Array<{ type: string; [key: string]: unknown }>);
  }

  // Get icon SVG based on type
  function getIcon(type: string): string {
    const icons: Record<string, string> = {
      server: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>`,
      database: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>`,
      network: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>`,
      storage: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>`,
      shield: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>`,
      chart: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>`,
    };
    return icons[type] || icons.server;
  }
</script>

<svelte:head>
  <title>Cloud Self-Service Portal | OCI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</svelte:head>

<div class="portal" onkeydown={handleKeyDown}>
  <!-- Header -->
  <header class="header">
    <div class="header-content">
      <div class="logo">
        <div class="logo-mark">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="url(#logo-gradient)"/>
            <path d="M8 16L14 10L20 16L14 22L8 16Z" fill="white" fill-opacity="0.9"/>
            <path d="M14 16L20 10L26 16L20 22L14 16Z" fill="white" fill-opacity="0.6"/>
            <defs>
              <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32">
                <stop stop-color="#0D9488"/>
                <stop offset="1" stop-color="#0F766E"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span class="logo-text">Cloud Portal</span>
      </div>
      
      <nav class="nav">
        <a href="/self-service" class="nav-link active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          Home
        </a>
        <a href="/self-service" class="nav-link">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
          Services
        </a>
        <a href="/" class="nav-link">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          AI Chat
        </a>
      </nav>

      <div class="header-actions">
        <button class="icon-btn" title="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          <span class="notification-badge">3</span>
        </button>
        <div class="user-menu">
          <div class="avatar">AC</div>
          <span class="user-name">Alex C.</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="hero">
    <div class="hero-content">
      <div class="hero-text">
        <p class="greeting">Hello Alex,</p>
        <h1 class="hero-title">Welcome to Cloud Self-Service</h1>
        <p class="hero-subtitle">Provision and manage your OCI resources with AI-powered assistance</p>
      </div>
      
      <!-- AI-Powered Search -->
      <div class="search-container">
        <SearchBox onSubmit={(query) => {
          showCommandPalette = true;
          chat.sendMessage({ text: query });
        }} />

        <div class="quick-links">
          <span class="quick-label">Quick actions:</span>
          {#each quickActions as action}
            <button
              type="button"
              class="quick-link"
              disabled={loadingAction !== null}
              onclick={() => handleQuickAction(action.prompt)}
              class:loading={loadingAction === action.prompt}
            >
              {#if loadingAction === action.prompt}
                <LoadingSpinner size="sm" />
              {/if}
              <span class="label-text">{action.label}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
    
    <div class="hero-visual">
      <div class="hero-graphic">
        <div class="graphic-ring ring-1"></div>
        <div class="graphic-ring ring-2"></div>
        <div class="graphic-ring ring-3"></div>
        <div class="graphic-center">
          <svg viewBox="0 0 48 48" fill="none">
            <path d="M24 4L44 14V34L24 44L4 34V14L24 4Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M24 4V44M4 14L44 34M44 14L4 34" stroke="currentColor" stroke-width="1" opacity="0.3"/>
            <circle cx="24" cy="24" r="6" fill="currentColor" opacity="0.2"/>
          </svg>
        </div>
      </div>
    </div>
  </section>

  <!-- Service Categories -->
  <section class="services">
    <div class="services-grid">
      {#each serviceCategories as category}
        <article class="service-card" data-color={category.color}>
          <div class="service-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              {@html getIcon(category.icon)}
            </svg>
          </div>
          <div class="service-content">
            <h3 class="service-title">{category.title}</h3>
            <p class="service-description">{category.description}</p>
            <div class="service-actions">
              {#each category.actions as action}
                <button 
                  class="service-action"
                  onclick={() => handleServiceAction(action)}
                >
                  {action}
                </button>
              {/each}
            </div>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <!-- Guided Workflows Section -->
  <section class="workflows-section">
    <div class="workflows-header">
      <h2 class="workflows-title">Guided Workflows</h2>
      <p class="workflows-subtitle">AI-assisted multi-step operations for common tasks</p>
    </div>
    <div class="workflows-grid">
      {#each featuredWorkflows as workflow}
        <button class="workflow-card" onclick={() => handleStartWorkflow(workflow)}>
          <div class="workflow-icon">
            {@html getWorkflowIconSvg(workflow.icon)}
          </div>
          <div class="workflow-content">
            <h3 class="workflow-name">{workflow.name}</h3>
            <p class="workflow-description">{workflow.description}</p>
            <div class="workflow-meta">
              <span class="workflow-steps">{workflow.steps.length} steps</span>
              <span class="workflow-time">~{workflow.estimatedDuration} min</span>
            </div>
          </div>
          <span class="workflow-arrow">→</span>
        </button>
      {/each}
    </div>
  </section>

  <!-- Bottom Section: Activity & Resources -->
  <section class="bottom-section">
    <div class="bottom-grid">
      <!-- Recent Activity -->
      <div class="activity-panel">
        <div class="panel-header">
          <h2 class="panel-title">Recent Activity</h2>
          <button class="panel-action">View All</button>
        </div>
        <div class="activity-list">
          {#each recentActivity as item}
            <div class="activity-item">
              <div class="activity-icon" data-type={item.type}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  {@html getIcon(item.type === 'compute' ? 'server' : item.type === 'database' ? 'database' : 'network')}
                </svg>
              </div>
              <div class="activity-details">
                <span class="activity-action">{item.action}</span>
                <span class="activity-id">{item.id} - {item.time}</span>
              </div>
              <span class="activity-status" data-status={item.status}>
                {item.status}
              </span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Quick Resources -->
      <div class="resources-panel">
        <div class="panel-header">
          <h2 class="panel-title">Resources</h2>
        </div>
        <div class="resources-list">
          <a href="https://docs.oracle.com/en-us/iaas/Content/home.htm" target="_blank" class="resource-link">
            OCI Documentation
          </a>
          <a href="https://docs.oracle.com/en-us/iaas/Content/API/Concepts/cliconcepts.htm" target="_blank" class="resource-link">
            CLI Reference Guide
          </a>
          <a href="https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm" target="_blank" class="resource-link">
            Free Tier Resources
          </a>
          <a href="https://cloud.oracle.com/compute/instances" target="_blank" class="resource-link">
            OCI Console
          </a>
        </div>
      </div>

      <!-- Contact/Help -->
      <div class="help-panel">
        <div class="panel-header">
          <h2 class="panel-title">Need Help?</h2>
        </div>
        <div class="help-content">
          <p class="help-text">Use the AI assistant for instant help with any cloud operations.</p>
          <button class="help-btn" onclick={() => handleQuickAction('Help me understand my current OCI infrastructure and costs')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            Ask AI Assistant
          </button>
        </div>
      </div>
    </div>
  </section>

  <!-- AI Command Palette / Chat Overlay -->
  {#if showCommandPalette}
    <div class="command-overlay">
      <button 
        class="command-backdrop" 
        onclick={() => showCommandPalette = false}
        aria-label="Close AI assistant"
      ></button>
      <div class="command-palette" role="dialog" aria-modal="true" aria-label="AI Assistant">
        <div class="command-header">
          <h3 class="command-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="command-icon">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            AI Assistant
          </h3>
          <button class="command-close" onclick={() => showCommandPalette = false} aria-label="Close AI assistant">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {#if activeWorkflowPlan}
          <div class="workflow-panel-container">
            <AgentWorkflowPanel
              isOpen={workflowPanelOpen}
              plan={activeWorkflowPlan}
              ontoggle={() => (workflowPanelOpen = !workflowPanelOpen)}
            />
          </div>
        {/if}
        
        <div class="command-messages">
          {#each chat.messages as message}
            <div class="message" data-role={message.role}>
              {#if message.role === 'user'}
                <div class="message-avatar user">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <div class="message-content">
                  <p>{getMessageText(message)}</p>
                </div>
              {:else}
                <div class="message-avatar assistant">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <div class="message-content">
                  <!-- Tool calls (hidden by default to make tool execution transparent) -->
                  {#each getToolParts(message) as part}
                    {@const uiState = getToolState(part.state)}
                    {@const toolResult = part.output as { success?: boolean; data?: unknown; error?: string } | undefined}
                    {@const isComplete = toolResult !== undefined}
                    {#if !hideToolExecution || (toolResult && !toolResult.success) || !isComplete}
                      <div class="tool-card" data-state={uiState}>
                        <div class="tool-header">
                          <span class="tool-name">{formatToolType(part.type)}</span>
                          <span class="tool-status">
                            {#if isComplete}
                              <!-- Tool has output, show appropriate status -->
                              {#if toolResult?.success === false}
                                <span class="status-dot error"></span>
                                Failed
                              {:else}
                                <span class="status-dot completed"></span>
                                Completed
                              {/if}
                            {:else if uiState === 'running' || uiState === 'streaming'}
                              <span class="status-dot running"></span>
                              Executing...
                            {:else}
                              <span class="status-dot pending"></span>
                              Pending
                            {/if}
                          </span>
                        </div>
                        {#if uiState === 'completed' && toolResult}
                          <div class="tool-result">
                            {#if toolResult.success}
                              <pre class="result-data">{JSON.stringify(toolResult.data, null, 2).slice(0, 500)}{JSON.stringify(toolResult.data).length > 500 ? '...' : ''}</pre>
                            {:else}
                              <p class="result-error">{toolResult.error || 'Unknown error'}</p>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  {/each}
                  
                  <!-- Text content -->
                  {#if getMessageText(message)}
                    <p class="assistant-text">{getMessageText(message)}</p>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
          
          {#if chat.status === 'streaming' || chat.status === 'submitted'}
            <div class="message" data-role="assistant">
              <div class="message-avatar assistant">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div class="message-content">
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <form class="command-input" onsubmit={handleChatSubmit}>
          <input
            type="text"
            placeholder="Ask a follow-up question..."
          />
          <button type="submit" disabled={chat.status === 'streaming'} aria-label="Send message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ========================================
     PORTAL BASE STYLES
     ServiceNow-inspired Enterprise Design
     ======================================== */
  
  .portal {
    --portal-teal: #0D9488;
    --portal-teal-dark: #0F766E;
    --portal-teal-light: #14B8A6;
    --portal-navy: #1E293B;
    --portal-navy-light: #334155;
    --portal-slate: #64748B;
    --portal-gray: #94A3B8;
    --portal-light: #F1F5F9;
    --portal-white: #FFFFFF;
    --portal-bg: #F8FAFC;
    --portal-success: #10B981;
    --portal-warning: #F59E0B;
    --portal-error: #EF4444;
    
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--portal-bg);
    min-height: 100vh;
    color: var(--portal-navy);
  }

  /* ========================================
     HEADER
     ======================================== */
  
  .header {
    background: var(--portal-white);
    border-bottom: 1px solid #E2E8F0;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .logo-mark {
    width: 36px;
    height: 36px;
  }

  .logo-mark svg {
    width: 100%;
    height: 100%;
  }

  .logo-text {
    font-weight: 700;
    font-size: 1.125rem;
    color: var(--portal-navy);
    letter-spacing: -0.02em;
  }

  .nav {
    display: flex;
    gap: 0.5rem;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    color: var(--portal-slate);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .nav-link:hover {
    color: var(--portal-navy);
    background: var(--portal-light);
  }

  .nav-link.active {
    color: var(--portal-teal);
    background: rgba(13, 148, 136, 0.08);
  }

  .nav-icon {
    width: 18px;
    height: 18px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .icon-btn {
    position: relative;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--portal-slate);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .icon-btn:hover {
    background: var(--portal-light);
    color: var(--portal-navy);
  }

  .icon-btn svg {
    width: 22px;
    height: 22px;
  }

  .notification-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 18px;
    height: 18px;
    background: var(--portal-teal);
    color: white;
    font-size: 0.65rem;
    font-weight: 600;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .user-menu {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.375rem 0.75rem 0.375rem 0.375rem;
    background: var(--portal-light);
    border-radius: 100px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .user-menu:hover {
    background: #E2E8F0;
  }

  .avatar {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, var(--portal-teal), var(--portal-teal-dark));
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .user-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--portal-navy);
  }

  /* ========================================
     HERO SECTION
     ======================================== */
  
  .hero {
    background: linear-gradient(135deg, var(--portal-white) 0%, var(--portal-light) 100%);
    padding: 3rem 2rem;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 3rem;
    max-width: 1400px;
    margin: 0 auto;
    align-items: center;
  }

  .hero-content {
    max-width: 700px;
  }

  .greeting {
    color: var(--portal-teal);
    font-size: 1.125rem;
    font-weight: 600;
    font-style: italic;
    margin-bottom: 0.25rem;
  }

  .hero-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--portal-navy);
    letter-spacing: -0.03em;
    line-height: 1.2;
    margin-bottom: 0.75rem;
  }

  .hero-subtitle {
    color: var(--portal-slate);
    font-size: 1.0625rem;
    margin-bottom: 2rem;
  }

  /* Search Box */
  .search-container {
    width: 100%;
  }

  .search-box {
    display: flex;
    align-items: center;
    background: var(--portal-white);
    border: 2px solid #E2E8F0;
    border-radius: 12px;
    padding: 0.25rem;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }

  .search-box.focused {
    border-color: var(--portal-teal);
    box-shadow: 0 0 0 4px rgba(13, 148, 136, 0.1), 0 4px 12px rgba(0,0,0,0.08);
  }

  .search-icon {
    padding: 0.75rem 1rem;
    color: var(--portal-gray);
  }

  .search-icon svg {
    width: 22px;
    height: 22px;
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 1rem;
    color: var(--portal-navy);
    outline: none;
    padding: 0.75rem 0;
  }

  .search-input::placeholder {
    color: var(--portal-gray);
  }

  .search-hint {
    padding: 0 1rem;
    color: var(--portal-gray);
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .search-hint kbd {
    background: var(--portal-light);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    font-weight: 500;
    border: 1px solid #E2E8F0;
  }

  .quick-links {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .quick-label {
    color: var(--portal-slate);
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .quick-link {
    color: var(--portal-teal);
    font-size: 0.8125rem;
    font-weight: 500;
    text-decoration: none;
    padding: 0.375rem 0.75rem;
    background: rgba(13, 148, 136, 0.08);
    border: none;
    border-radius: 100px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quick-link:hover {
    background: rgba(13, 148, 136, 0.15);
    text-decoration: none;
  }

  .quick-link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .quick-link.loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(13, 148, 136, 0.2);
  }

  .quick-link.loading .label-text {
    display: none;
  }

  /* Hero Visual */
  .hero-visual {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hero-graphic {
    position: relative;
    width: 280px;
    height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .graphic-ring {
    position: absolute;
    border-radius: 50%;
    border: 1px solid rgba(13, 148, 136, 0.15);
    animation: pulse 4s ease-in-out infinite;
  }

  .ring-1 {
    width: 100%;
    height: 100%;
    animation-delay: 0s;
  }

  .ring-2 {
    width: 75%;
    height: 75%;
    animation-delay: 0.5s;
  }

  .ring-3 {
    width: 50%;
    height: 50%;
    animation-delay: 1s;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.02); }
  }

  .graphic-center {
    width: 80px;
    height: 80px;
    color: var(--portal-teal);
    z-index: 1;
  }

  .graphic-center svg {
    width: 100%;
    height: 100%;
  }

  /* ========================================
     SERVICE CATEGORIES
     ======================================== */
  
  .services {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  .services-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  .service-card {
    background: var(--portal-white);
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid #E2E8F0;
    transition: all 0.2s ease;
    display: flex;
    gap: 1rem;
  }

  .service-card:hover {
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    transform: translateY(-2px);
    border-color: transparent;
  }

  .service-icon {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .service-card[data-color="teal"] .service-icon {
    background: rgba(13, 148, 136, 0.1);
    color: var(--portal-teal);
  }

  .service-card[data-color="indigo"] .service-icon {
    background: rgba(79, 70, 229, 0.1);
    color: #4F46E5;
  }

  .service-card[data-color="emerald"] .service-icon {
    background: rgba(16, 185, 129, 0.1);
    color: #10B981;
  }

  .service-card[data-color="amber"] .service-icon {
    background: rgba(245, 158, 11, 0.1);
    color: #F59E0B;
  }

  .service-card[data-color="rose"] .service-icon {
    background: rgba(244, 63, 94, 0.1);
    color: #F43F5E;
  }

  .service-card[data-color="violet"] .service-icon {
    background: rgba(139, 92, 246, 0.1);
    color: #8B5CF6;
  }

  .service-icon svg {
    width: 24px;
    height: 24px;
  }

  .service-content {
    flex: 1;
    min-width: 0;
  }

  .service-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--portal-navy);
    margin-bottom: 0.25rem;
  }

  .service-description {
    font-size: 0.8125rem;
    color: var(--portal-slate);
    margin-bottom: 0.75rem;
    line-height: 1.5;
  }

  .service-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .service-action {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--portal-teal);
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.15s ease;
  }

  .service-action:hover {
    color: var(--portal-teal-dark);
  }

  .service-action:not(:last-child)::after {
    content: "|";
    margin-left: 0.5rem;
    color: #CBD5E1;
    text-decoration: none;
    display: inline-block;
  }

  /* ========================================
     BOTTOM SECTION
     ======================================== */
  
  .bottom-section {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem 3rem;
  }

  .bottom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1.5rem;
  }

  .activity-panel,
  .resources-panel,
  .help-panel {
    background: var(--portal-white);
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #E2E8F0;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    background: linear-gradient(135deg, rgba(13, 148, 136, 0.08), rgba(13, 148, 136, 0.15));
    border-bottom: 1px solid rgba(13, 148, 136, 0.2);
  }

  .activity-panel .panel-header ~ *,
  .resources-panel .panel-header ~ *,
  .help-panel .panel-header ~ * {
    padding: 1.5rem;
  }

  .panel-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--portal-teal-dark);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .panel-action {
    font-size: 0.8125rem;
    color: var(--portal-teal);
    background: transparent;
    border: none;
    cursor: pointer;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .panel-action:hover {
    text-decoration: underline;
  }

  /* Activity List */
  .activity-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .activity-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--portal-light);
    border-radius: 8px;
  }

  .activity-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .activity-icon[data-type="compute"] {
    background: rgba(13, 148, 136, 0.15);
    color: var(--portal-teal);
  }

  .activity-icon[data-type="database"] {
    background: rgba(79, 70, 229, 0.15);
    color: #4F46E5;
  }

  .activity-icon[data-type="networking"] {
    background: rgba(16, 185, 129, 0.15);
    color: #10B981;
  }

  .activity-icon svg {
    width: 16px;
    height: 16px;
  }

  .activity-details {
    flex: 1;
    min-width: 0;
  }

  .activity-action {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--portal-navy);
  }

  .activity-id {
    display: block;
    font-size: 0.75rem;
    color: var(--portal-slate);
  }

  .activity-status {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.625rem;
    border-radius: 100px;
  }

  .activity-status[data-status="completed"] {
    background: rgba(16, 185, 129, 0.15);
    color: #059669;
  }

  .activity-status[data-status="pending"] {
    background: rgba(245, 158, 11, 0.15);
    color: #D97706;
  }

  /* Resources List */
  .resources-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .resource-link {
    display: block;
    font-size: 0.875rem;
    color: var(--portal-teal);
    text-decoration: none;
    padding: 0.625rem 0;
    border-bottom: 1px solid #E2E8F0;
    transition: color 0.15s ease;
  }

  .resource-link:hover {
    color: var(--portal-teal-dark);
    text-decoration: underline;
  }

  .resource-link:last-child {
    border-bottom: none;
  }

  /* Help Panel */
  .help-content {
    text-align: center;
  }

  .help-text {
    font-size: 0.875rem;
    color: var(--portal-slate);
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .help-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, var(--portal-teal), var(--portal-teal-dark));
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .help-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
  }

  .help-btn svg {
    width: 18px;
    height: 18px;
  }

  /* ========================================
     COMMAND PALETTE / AI CHAT OVERLAY
     ======================================== */
  
  .command-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 5vh 1rem;
    animation: fadeIn 0.15s ease;
  }

  .command-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    border: none;
    cursor: pointer;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .command-palette {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 700px;
    max-height: 80vh;
    background: var(--portal-white);
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .command-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #E2E8F0;
  }

  .command-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--portal-navy);
  }

  .command-icon {
    width: 20px;
    height: 20px;
    color: var(--portal-teal);
  }

  .command-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--portal-slate);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .command-close:hover {
    background: var(--portal-light);
    color: var(--portal-navy);
  }

  .command-close svg {
    width: 18px;
    height: 18px;
  }

  .command-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-height: 150px;
  }

  .message {
    display: flex;
    gap: 0.75rem;
  }

  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .message-avatar.user {
    background: var(--portal-light);
    color: var(--portal-slate);
  }

  .message-avatar.assistant {
    background: linear-gradient(135deg, var(--portal-teal), var(--portal-teal-dark));
    color: white;
  }

  .message-avatar svg {
    width: 18px;
    height: 18px;
  }

  .message-content {
    flex: 1;
    min-width: 0;
  }

  .message[data-role="user"] .message-content p {
    background: var(--portal-light);
    padding: 0.75rem 1rem;
    border-radius: 12px;
    border-top-left-radius: 4px;
    font-size: 0.9375rem;
    color: var(--portal-navy);
    display: inline-block;
  }

  .assistant-text {
    font-size: 0.9375rem;
    color: var(--portal-navy);
    line-height: 1.6;
    white-space: pre-wrap;
  }

  /* Tool Card in Chat */
  .tool-card {
    background: var(--portal-light);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
    border-left: 3px solid var(--portal-teal);
  }

  .tool-card[data-state="call"] {
    border-left-color: var(--portal-warning);
  }

  .tool-card[data-state="result"] {
    border-left-color: var(--portal-success);
  }

  .tool-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .tool-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--portal-navy);
    font-family: 'JetBrains Mono', monospace;
  }

  .tool-status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--portal-slate);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot.running {
    background: var(--portal-warning);
    animation: blink 1s infinite;
  }

  .status-dot.completed {
    background: var(--portal-success);
  }

  .status-dot.pending {
    background: var(--portal-gray);
  }

  .status-dot.error {
    background: var(--portal-error, #EF4444);
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .tool-result {
    margin-top: 0.5rem;
  }

  .result-data {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    background: var(--portal-white);
    padding: 0.75rem;
    border-radius: 6px;
    overflow-x: auto;
    max-height: 200px;
    overflow-y: auto;
    color: var(--portal-navy-light);
  }

  .result-error {
    font-size: 0.8125rem;
    color: var(--portal-error);
  }

  /* Typing Indicator */
  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 0.75rem 1rem;
    background: var(--portal-light);
    border-radius: 12px;
    border-top-left-radius: 4px;
    width: fit-content;
  }

  .typing-indicator span {
    width: 8px;
    height: 8px;
    background: var(--portal-gray);
    border-radius: 50%;
    animation: typing 1.4s infinite ease-in-out;
  }

  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-4px); opacity: 1; }
  }

  /* Command Input */
  .command-input {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #E2E8F0;
  }

  .command-input input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    font-size: 0.9375rem;
    color: var(--portal-navy);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .command-input input:focus {
    border-color: var(--portal-teal);
  }

  .command-input input::placeholder {
    color: var(--portal-gray);
  }

  .command-input button {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--portal-teal), var(--portal-teal-dark));
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .command-input button:hover:not(:disabled) {
    transform: scale(1.05);
  }

  .command-input button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .command-input button svg {
    width: 20px;
    height: 20px;
  }

  /* ========================================
     GUIDED WORKFLOWS
     ======================================== */

  .workflows-section {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  .workflows-header {
    margin-bottom: 1.5rem;
  }

  .workflows-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--portal-navy);
    margin-bottom: 0.25rem;
  }

  .workflows-subtitle {
    font-size: 0.875rem;
    color: var(--portal-slate);
  }

  .workflows-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .workflow-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--portal-white);
    border: 1px solid #E2E8F0;
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
  }

  .workflow-card:hover {
    border-color: var(--portal-teal);
    box-shadow: 0 4px 12px rgba(13, 148, 136, 0.15);
    transform: translateY(-2px);
  }

  .workflow-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .workflow-content {
    flex: 1;
    min-width: 0;
  }

  .workflow-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--portal-navy);
    margin-bottom: 0.25rem;
  }

  .workflow-description {
    font-size: 0.8125rem;
    color: var(--portal-slate);
    margin-bottom: 0.5rem;
    line-height: 1.4;
  }

  .workflow-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--portal-gray);
  }

  .workflow-arrow {
    color: var(--portal-teal);
    font-size: 1.25rem;
    opacity: 0;
    transform: translateX(-4px);
    transition: all 0.2s ease;
  }

  .workflow-card:hover .workflow-arrow {
    opacity: 1;
    transform: translateX(0);
  }

  .workflow-panel-container {
    border-bottom: 1px solid #E2E8F0;
    padding: 1rem 1.5rem;
    background: var(--portal-white);
    max-height: 40vh;
    overflow-y: auto;
    flex-shrink: 0;
    
    /* Map design system variables for AgentWorkflowPanel compatibility */
    --text-primary: var(--portal-navy);
    --text-secondary: var(--portal-navy-light);
    --text-tertiary: var(--portal-slate);
    --bg-tertiary: #F1F5F9;
    --bg-secondary: var(--portal-light);
    --bg-elevated: #E2E8F0;
    --bg-hover: #CBD5E1;
    --border-default: #CBD5E1;
    --border-muted: #E2E8F0;
    --color-success: #10B981;
    --color-executing: var(--portal-teal);
    --color-error: #EF4444;
    --color-info: #3B82F6;
    --color-warning: #F59E0B;
    --fg-primary: var(--portal-navy);
    --fg-secondary: var(--portal-slate);
    --fg-tertiary: var(--portal-gray);
    --accent-primary: var(--portal-teal);
    --semantic-success: #10B981;
    --semantic-error: #EF4444;
    --semantic-warning: #F59E0B;
    --semantic-info: #3B82F6;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-full: 9999px;
    --space-sm: 0.5rem;
    --space-md: 1rem;
    --transition-fast: 150ms ease;
    --transition-normal: 250ms ease;
  }

  /* Panel styles for Collapsible component inside workflow container */
  .workflow-panel-container :global(.panel) {
    background-color: var(--portal-white);
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    margin-bottom: 0;
  }

  .workflow-panel-container :global(.panel-header) {
    background-color: var(--portal-light);
    border-bottom: 1px solid #E2E8F0;
    padding: 0.5rem 1rem;
    cursor: pointer;
    user-select: none;
    border-radius: 8px 8px 0 0;
  }

  .workflow-panel-container :global(.panel-header:hover) {
    background-color: #E2E8F0;
  }

  .workflow-panel-container :global(.panel-content) {
    padding: 1rem;
    background: var(--portal-white);
    border-radius: 0 0 8px 8px;
  }

  /* Text utilities for workflow container */
  .workflow-panel-container :global(.text-primary) {
    color: var(--portal-navy);
  }

  .workflow-panel-container :global(.text-secondary) {
    color: var(--portal-slate);
  }

  .workflow-panel-container :global(.text-tertiary) {
    color: var(--portal-gray);
  }

  .workflow-panel-container :global(.text-success) {
    color: #10B981;
  }

  .workflow-panel-container :global(.text-error) {
    color: #EF4444;
  }

  /* Badge styles for workflow container */
  .workflow-panel-container :global(.badge) {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .workflow-panel-container :global(.badge-default) {
    background-color: #E2E8F0;
    color: var(--portal-slate);
  }

  .workflow-panel-container :global(.badge-success) {
    background-color: #10B981;
    color: white;
  }

  .workflow-panel-container :global(.badge-warning) {
    background-color: #F59E0B;
    color: white;
  }

  .workflow-panel-container :global(.badge-error) {
    background-color: #EF4444;
    color: white;
  }

  .workflow-panel-container :global(.badge-info) {
    background-color: #3B82F6;
    color: white;
  }

  /* Spinner and animation utilities */
  .workflow-panel-container :global(.animate-slide-in-up) {
    animation: slideUp 0.15s ease;
  }

  /* Layout utilities */
  .workflow-panel-container :global(.flex) {
    display: flex;
  }

  .workflow-panel-container :global(.items-center) {
    align-items: center;
  }

  .workflow-panel-container :global(.justify-between) {
    justify-content: space-between;
  }

  .workflow-panel-container :global(.gap-2) {
    gap: 0.5rem;
  }

  .workflow-panel-container :global(.w-full) {
    width: 100%;
  }

  .workflow-panel-container :global(.mb-2) {
    margin-bottom: 0.5rem;
  }

  .workflow-panel-container :global(.mb-3) {
    margin-bottom: 0.75rem;
  }

  .workflow-panel-container :global(.ml-2) {
    margin-left: 0.5rem;
  }

  .workflow-panel-container :global(.font-medium) {
    font-weight: 500;
  }

  .workflow-panel-container :global(.text-sm) {
    font-size: 0.875rem;
  }

  .workflow-panel-container :global(.text-xs) {
    font-size: 0.75rem;
  }

  .workflow-panel-container :global(.space-y-4 > * + *) {
    margin-top: 1rem;
  }

  .workflow-panel-container :global(.rounded-t-md) {
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
  }

  .workflow-panel-container :global(.rotate-90) {
    transform: rotate(90deg);
  }

  .workflow-panel-container :global(.transition-transform) {
    transition: transform 0.15s ease;
  }

  /* ========================================
     RESPONSIVE
     ======================================== */
  
  @media (max-width: 1024px) {
    .services-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .bottom-grid {
      grid-template-columns: 1fr;
    }

    .hero {
      grid-template-columns: 1fr;
    }

    .hero-visual {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .header-content {
      padding: 0 1rem;
    }

    .nav {
      display: none;
    }

    .user-name {
      display: none;
    }

    .hero {
      padding: 2rem 1rem;
    }

    .hero-title {
      font-size: 1.75rem;
    }

    .services {
      padding: 1rem;
    }

    .services-grid {
      grid-template-columns: 1fr;
    }

    .workflows-grid {
      grid-template-columns: 1fr;
    }

    .bottom-section {
      padding: 0 1rem 2rem;
    }

    .command-palette {
      max-height: 90vh;
      border-radius: 12px 12px 0 0;
      margin-top: auto;
    }
  }
</style>
