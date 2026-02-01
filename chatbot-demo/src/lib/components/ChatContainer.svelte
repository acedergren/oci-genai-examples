<script lang="ts">
  import type { UIMessage } from 'ai';
  import MessageComponent from './Message.svelte';

  interface Props {
    messages: UIMessage[];
    isLoading?: boolean;
  }

  let { messages, isLoading = false }: Props = $props();
  let containerRef: HTMLDivElement;

  $effect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (containerRef && messages.length > 0) {
      containerRef.scrollTop = containerRef.scrollHeight;
    }
  });

  // Extract text content from message parts
  function getMessageContent(message: UIMessage): string {
    if (!message.parts) return '';
    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map(part => part.text)
      .join('');
  }
</script>

<div
  bind:this={containerRef}
  class="flex-1 overflow-y-auto p-6 space-y-4"
>
  {#if messages.length === 0}
    <div class="flex items-center justify-center h-full text-text-tertiary">
      <p>Start chatting with OCI GenAI...</p>
    </div>
  {:else}
    {#each messages as message (message.id)}
      <MessageComponent
        role={message.role}
        content={getMessageContent(message)}
        isStreaming={isLoading && message === messages[messages.length - 1]}
      />
    {/each}
  {/if}
</div>
