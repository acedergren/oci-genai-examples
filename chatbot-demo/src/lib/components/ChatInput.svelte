<script lang="ts">
  import Button from './Button.svelte';

  interface Props {
    value: string;
    onSubmit: () => void;
    disabled?: boolean;
  }

  let { value = $bindable(), onSubmit, disabled = false }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); onSubmit(); }} class="glass-effect rounded-lg p-4">
  <div class="flex gap-2">
    <textarea
      bind:value
      onkeydown={handleKeydown}
      {disabled}
      placeholder="Type your message..."
      rows="1"
      aria-label="Chat message input"
      class="flex-1 bg-surface-elevated rounded-lg px-4 py-2 text-text-primary placeholder-text-tertiary resize-none focus:outline-none focus:ring-2 focus:ring-accent-primary"
    ></textarea>
    <Button type="submit" disabled={disabled || !value.trim()} aria-label="Send message">
      Send
    </Button>
  </div>
</form>
