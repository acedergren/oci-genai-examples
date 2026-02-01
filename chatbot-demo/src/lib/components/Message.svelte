<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    role: 'user' | 'assistant' | 'system';
    content: string;
    isStreaming?: boolean;
  }

  let { role, content, isStreaming = false }: Props = $props();
</script>

<div
  class={cn(
    'flex w-full mb-4',
    role === 'user' ? 'justify-end' : 'justify-start'
  )}
>
  <div
    class={cn(
      'max-w-[80%] rounded-lg px-4 py-3',
      role === 'user' && 'accent-gradient text-white',
      role === 'assistant' && 'glass-effect',
      isStreaming && 'shimmer'
    )}
  >
    <div class="prose prose-invert prose-sm max-w-none">
      {content}
    </div>
  </div>
</div>
