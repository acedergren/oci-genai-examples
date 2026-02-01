<script lang="ts">
  import { cn } from "$lib/utils";
  import type { UIMessage } from "ai";
  import SvelteMarkdown from "svelte-markdown";
  
  let { message }: { message: UIMessage } = $props();
  
  const isUser = $derived(message.role === 'user');
  
  // Find reasoning and text parts
  let reasoning = $derived.by(() => {
    const part = message.parts.find(p => p.type === 'reasoning');
    return part?.type === 'reasoning' ? part.text : '';
  });

  let textContent = $derived.by(() => {
    return message.parts
      .filter(p => p.type === 'text')
      .map(p => p.type === 'text' ? p.text : '')
      .join('');
  });
</script>

<div class={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
  <div class={cn(
    "relative max-w-[80%] rounded-2xl px-4 py-3 text-sm",
    isUser 
      ? "bg-primary text-primary-foreground rounded-br-none" 
      : "bg-muted text-foreground rounded-bl-none"
  )}>
    {#if reasoning}
      <div class="mb-2 p-2 bg-black/5 rounded text-xs italic border-l-2 border-primary/50 text-muted-foreground">
        <span class="font-semibold not-italic block mb-1">Thinking:</span>
        {reasoning}
      </div>
    {/if}
    
    <div class="prose dark:prose-invert max-w-none break-words">
      <SvelteMarkdown source={textContent} />
    </div>
  </div>
</div>
