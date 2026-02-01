<script lang="ts">
  import { Textarea } from "$lib/components/ui/textarea";
  import { Button } from "$lib/components/ui/button";
  import { SendHorizontal } from "lucide-svelte";

  let { 
    value = $bindable(""), 
    isLoading = false, 
    placeholder = "Send a message...",
    onsubmit 
  }: {
    value: string;
    isLoading?: boolean;
    placeholder?: string;
    onsubmit: () => void;
  } = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onsubmit();
    }
  }
</script>

<div class="relative flex items-end w-full p-2 bg-background border rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-ring">
  <Textarea
    bind:value
    {placeholder}
    rows={1}
    class="min-h-[44px] w-full resize-none bg-transparent border-0 shadow-none focus-visible:ring-0 px-4 py-3"
    onkeydown={handleKeydown}
  />
  <Button 
    type="submit" 
    size="icon" 
    disabled={isLoading || !value.trim()} 
    class="mb-1 mr-1 h-8 w-8 shrink-0 rounded-lg"
    onclick={onsubmit}
  >
    <SendHorizontal class="h-4 w-4" />
    <span class="sr-only">Send</span>
  </Button>
</div>
