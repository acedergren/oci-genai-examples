<script lang="ts">
  import { Chat } from '@ai-sdk/svelte';
  import { DefaultChatTransport } from 'ai';
  import ChatList from "./ChatList.svelte";
  import ChatInput from "./ChatInput.svelte";
  import { cn } from "$lib/utils";

  let { 
    class: className,
    modelId = 'meta.llama-3.3-70b-instruct'
  }: { 
    class?: string;
    modelId?: string;
  } = $props();

  let input = $state('');

  // Re-instantiate chat when modelId changes
  const chat = $derived.by(() => {
    return new Chat({
      transport: new DefaultChatTransport({
        api: '/api/chat',
        body: { model: modelId }
      }),
      onError: (error) => {
        console.error("Chat error:", error);
      }
    });
  });

  async function handleSubmit() {
    if (!input.trim()) return;
    const text = input;
    input = '';
    await chat.sendMessage({ text });
  }
</script>

<div class={cn("flex flex-col h-full w-full max-w-3xl mx-auto", className)}>
  <div class="flex-1 overflow-hidden">
    <ChatList messages={chat.messages} />
  </div>
  
  <div class="p-4 pt-0">
    <ChatInput 
      bind:value={input} 
      isLoading={chat.status === 'streaming' || chat.status === 'submitted'} 
      onsubmit={handleSubmit}
    />
  </div>
</div>
