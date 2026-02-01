<script lang="ts">
  import type { UIMessage } from "ai";
  import ChatMessage from "./ChatMessage.svelte";
  import { tick } from "svelte";

  let { messages = [] }: { messages: UIMessage[] } = $props();
  
  let messagesEndRef = $state<HTMLDivElement>();

  function scrollToBottom() {
    if (messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: "smooth" });
    }
  }

  $effect(() => {
    if (messages.length) {
      tick().then(scrollToBottom);
    }
  });
</script>

<div class="flex-1 overflow-y-auto p-4 space-y-4">
  {#if messages.length === 0}
    <div class="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
      <div class="rounded-full bg-muted p-4 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
      </div>
      <h3 class="font-semibold text-lg">AI Chatbot</h3>
      <p class="text-sm max-w-sm mt-2">
        Powered by OCI Generative AI using Llama 3.3. Start a conversation below.
      </p>
    </div>
  {:else}
    {#each messages as message (message.id)}
      <ChatMessage {message} />
    {/each}
    <div bind:this={messagesEndRef}></div>
  {/if}
</div>
