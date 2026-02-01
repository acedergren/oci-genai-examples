<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'accent' | 'ghost';
    children?: Snippet;
  }

  let { variant = 'accent', disabled = false, type = 'button', children, ...restProps }: Props = $props();
</script>

<button
  {type}
  {disabled}
  class={cn(
    'px-4 py-2 rounded-lg font-medium transition-all duration-200',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variant === 'accent' && 'accent-gradient text-white shadow-lg hover:brightness-110 hover:-translate-y-0.5',
    variant === 'ghost' && 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
  )}
  {...restProps}
>
  {@render children?.()}
</button>
