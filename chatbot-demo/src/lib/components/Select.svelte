<script lang="ts">
  interface Props {
    options: { value: string; label: string }[];
    value: string;
    onchange?: (value: string) => void;
  }

  let { options, value = $bindable(), onchange }: Props = $props();

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    value = target.value;
    onchange?.(value);
  }
</script>

<select
  {value}
  onchange={handleChange}
  aria-label="Select AI model"
  class="glass-effect rounded-lg px-3 py-2 text-text-primary bg-surface-raised border-border focus:outline-none focus:ring-2 focus:ring-accent-primary"
>
  {#each options as option}
    <option value={option.value}>{option.label}</option>
  {/each}
</select>
