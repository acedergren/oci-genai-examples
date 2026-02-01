<script lang="ts">
  import { Collapsible, Spinner, Badge } from '$lib/components/ui/index.js';
  import type { ToolCall } from '$lib/tools/types.js';

  interface Props {
    isOpen?: boolean;
    tools?: ToolCall[];
    pendingApproval?: ToolCall;
    ontoggle?: () => void;
    onapprove?: (toolId: string) => void;
    onreject?: (toolId: string) => void;
  }

  let {
    isOpen = false,
    tools = [],
    pendingApproval,
    ontoggle,
    onapprove,
    onreject,
  }: Props = $props();

  const runningCount = $derived(tools.filter((t) => t.status === 'running').length);

  const statusColors: Record<string, string> = {
    pending: 'text-tertiary',
    awaiting_approval: 'text-warning',
    running: 'text-executing',
    completed: 'text-success',
    error: 'text-error',
  };

  const statusIcons: Record<string, string> = {
    pending: '○',
    awaiting_approval: '?',
    running: '●',
    completed: '✓',
    error: '✗',
  };

  function isDanger(toolName: string): boolean {
    const name = toolName.toLowerCase();
    return name.startsWith('delete') || name.startsWith('terminate') || name.startsWith('stop');
  }
</script>

<Collapsible title="Tools" {isOpen} shortcut="o" {ontoggle}>
  {#snippet badge()}
    <div class="flex items-center gap-1">
      {#if runningCount > 0}
        <Spinner size="sm" />
        <Badge variant="info">{runningCount}</Badge>
      {:else if tools.length > 0}
        <Badge variant="default">{tools.length}</Badge>
      {/if}
    </div>
  {/snippet}

  <div class="space-y-3">
    <!-- Pending Approval Alert -->
    {#if pendingApproval}
      <div
        class="tool-approval animate-slide-in-up"
        class:danger={isDanger(pendingApproval.name)}
      >
        <div class="flex items-center gap-2 mb-2">
          <span class={isDanger(pendingApproval.name) ? 'text-error' : 'text-warning'}>
            {isDanger(pendingApproval.name) ? '⚠ DANGER' : '? Confirm'}
          </span>
          <Badge variant={isDanger(pendingApproval.name) ? 'error' : 'warning'}>
            Approval Required
          </Badge>
        </div>

        <p class="text-primary font-medium mb-2">{pendingApproval.name}</p>

        <div class="bg-tertiary p-2 rounded text-sm mb-3 max-h-32 overflow-y-auto">
          <p class="text-tertiary mb-1">Arguments:</p>
          {#each Object.entries(pendingApproval.args) as [key, value]}
            <div class="flex gap-2">
              <span class="text-secondary">{key}:</span>
              <span class="text-primary truncate">
                {typeof value === 'string' ? value : JSON.stringify(value)}
              </span>
            </div>
          {/each}
        </div>

        <div class="flex gap-3">
          <button
            class="btn btn-success text-sm"
            onclick={() => onapprove?.(pendingApproval.id)}
          >
            ✓ Approve (y)
          </button>
          <button
            class="btn btn-danger text-sm"
            onclick={() => onreject?.(pendingApproval.id)}
          >
            ✗ Reject (n)
          </button>
        </div>
      </div>
    {/if}

    <!-- Tool History -->
    <div class="max-h-40 overflow-y-auto space-y-1">
      {#if tools.length > 0}
        {#each tools as tool (tool.id)}
          <div class="flex items-center gap-2 text-sm">
            <span class={statusColors[tool.status]}>
              {#if tool.status === 'running'}
                <Spinner size="sm" />
              {:else}
                {statusIcons[tool.status]}
              {/if}
            </span>
            <span class="text-secondary">{tool.name}</span>
            {#if tool.completedAt && tool.startedAt}
              <span class="text-tertiary text-xs">
                {tool.completedAt - tool.startedAt}ms
              </span>
            {/if}
          </div>
        {/each}
      {:else if !pendingApproval}
        <p class="text-tertiary text-sm italic">No tool executions</p>
      {/if}
    </div>
  </div>
</Collapsible>
